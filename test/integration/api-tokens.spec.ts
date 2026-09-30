import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { addMember, createApiToken, createEvent, createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

type Who = 'admin' | 'owner' | 'manager' | 'viewer'

describe('API tokens', () => {
  let t: TestApp
  const tokens = {} as Record<Who, string>
  let eventId: number

  beforeAll(async () => {
    t = await createTestApp()
    const ids = {} as Record<Who, number>
    for (const name of ['admin', 'owner', 'manager', 'viewer'] as Who[]) {
      const user = await createUser({
        email: `${name}@example.com`,
        role: name === 'admin' ? 'SUPER_ADMIN' : 'USER',
      })
      ids[name] = user.id
      tokens[name] = await loginAs(`${name}@example.com`)
    }
    const event = await createEvent()
    eventId = event.id
    await addMember({ eventId, userId: ids.owner, role: 'OWNER', isPrimaryOwner: true })
    await addMember({ eventId, userId: ids.manager, role: 'MANAGER' })
    await addMember({ eventId, userId: ids.viewer, role: 'VIEWER' })
  })

  beforeEach(async () => {
    await testPrisma().apiToken.deleteMany()
    await testPrisma().event.update({ where: { id: eventId }, data: { status: 'ACTIVE' } })
  })

  afterAll(() => t.close())

  async function loginAs(email: string): Promise<string> {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'correct-password' })
    return res.body.data.token as string
  }

  const path = (suffix = '') => `/api/v1/events/${eventId}/api-tokens${suffix}`

  it('gives an Owner the value once, which then opens the public read of the Event', async () => {
    const created = await t
      .http()
      .post(path())
      .auth(tokens.owner, { type: 'bearer' })
      .send({ name: 'Site', scopes: ['event:read', 'rsvp:create'] })

    expect(created.status).toBe(201)
    expect(created.body.data).toEqual({
      id: expect.any(Number),
      eventId,
      name: 'Site',
      scopes: ['event:read', 'rsvp:create'],
      isActive: true,
      lastUsedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      value: expect.stringMatching(/^evt_[A-Za-z0-9_-]{43}$/),
    })

    const publicRead = await t
      .http()
      .get(`/api/v1/events/${eventId}/public`)
      .set('X-Api-Key', created.body.data.value)
    expect(publicRead.status).toBe(200)

    // Listing and reading never show the value nor its hash again.
    const listed = await t.http().get(path()).auth(tokens.owner, { type: 'bearer' })
    const shown = await t
      .http()
      .get(path(`/${created.body.data.id}`))
      .auth(tokens.owner, { type: 'bearer' })
    for (const body of [listed.body.data[0], shown.body.data]) {
      expect(body).not.toHaveProperty('value')
      expect(body).not.toHaveProperty('tokenHash')
      expect(body.lastUsedAt).toEqual(expect.any(String))
    }
    const row = await testPrisma().apiToken.findUniqueOrThrow({
      where: { id: created.body.data.id },
    })
    expect(JSON.stringify(row)).not.toContain(created.body.data.value)
  })

  it('refuses Managers and Viewers every route with 403', async () => {
    const { id } = await createApiToken({ eventId })
    for (const who of ['manager', 'viewer'] as const) {
      const responses = [
        await t
          .http()
          .post(path())
          .auth(tokens[who], { type: 'bearer' })
          .send({ name: 'X', scopes: ['event:read'] }),
        await t.http().get(path()).auth(tokens[who], { type: 'bearer' }),
        await t
          .http()
          .get(path(`/${id}`))
          .auth(tokens[who], { type: 'bearer' }),
        await t
          .http()
          .patch(path(`/${id}`))
          .auth(tokens[who], { type: 'bearer' })
          .send({ isActive: false }),
        await t
          .http()
          .delete(path(`/${id}`))
          .auth(tokens[who], { type: 'bearer' }),
      ]
      for (const res of responses) {
        expect(res.status).toBe(403)
        expect(res.body).toEqual(error('FORBIDDEN'))
      }
    }
  })

  it('refuses the API token itself on the routes that manage tokens, with 401', async () => {
    const { value } = await createApiToken({ eventId, scopes: ['event:read', 'rsvp:create'] })

    const res = await t.http().get(path()).set('X-Api-Key', value)
    expect(res.status).toBe(401)
    expect(res.body).toEqual(error('UNAUTHENTICATED'))
  })

  it('lets an Owner rename, change the Scopes of and deactivate a token', async () => {
    const { id, value } = await createApiToken({ eventId, scopes: ['event:read'] })

    const updated = await t
      .http()
      .patch(path(`/${id}`))
      .auth(tokens.owner, { type: 'bearer' })
      .send({ name: 'Site novo', scopes: ['event:read', 'registry:read'], isActive: false })
    expect(updated.status).toBe(200)
    expect(updated.body.data).toMatchObject({
      name: 'Site novo',
      scopes: ['event:read', 'registry:read'],
      isActive: false,
    })

    const publicRead = await t
      .http()
      .get(`/api/v1/events/${eventId}/public`)
      .set('X-Api-Key', value)
    expect(publicRead.status).toBe(401)
  })

  it('refuses repeated Scopes and unknown fields with 400', async () => {
    const repeated = await t
      .http()
      .post(path())
      .auth(tokens.owner, { type: 'bearer' })
      .send({ name: 'Site', scopes: ['event:read', 'event:read'] })
    const unknown = await t
      .http()
      .post(path())
      .auth(tokens.owner, { type: 'bearer' })
      .send({ name: 'Site', scopes: ['admin:all'] })
    for (const res of [repeated, unknown]) {
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it("answers 404 for another Event's token", async () => {
    const other = await createEvent()
    const foreign = await createApiToken({ eventId: other.id })

    const res = await t
      .http()
      .get(path(`/${foreign.id}`))
      .auth(tokens.owner, { type: 'bearer' })
    expect(res.status).toBe(404)
    expect(res.body).toEqual(error('API_TOKEN_NOT_FOUND'))
  })

  it('lets an Owner only revoke on an Archived event', async () => {
    const { id } = await createApiToken({ eventId })
    const second = await createApiToken({ eventId })
    await testPrisma().event.update({ where: { id: eventId }, data: { status: 'ARCHIVED' } })

    const create = await t
      .http()
      .post(path())
      .auth(tokens.owner, { type: 'bearer' })
      .send({ name: 'Site', scopes: ['event:read'] })
    const rename = await t
      .http()
      .patch(path(`/${id}`))
      .auth(tokens.owner, { type: 'bearer' })
      .send({ name: 'Outro' })
    for (const res of [create, rename]) {
      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('EVENT_ARCHIVED'))
    }

    const deactivate = await t
      .http()
      .patch(path(`/${id}`))
      .auth(tokens.owner, { type: 'bearer' })
      .send({ isActive: false })
    expect(deactivate.status).toBe(200)
    const remove = await t
      .http()
      .delete(path(`/${second.id}`))
      .auth(tokens.owner, { type: 'bearer' })
    expect(remove.status).toBe(204)

    const reactivate = await t
      .http()
      .patch(path(`/${id}`))
      .auth(tokens.admin, { type: 'bearer' })
      .send({ isActive: true })
    expect(reactivate.status).toBe(200)
  })
})
