import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { addMember, createApiToken, createEvent, createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

describe('GET /api/v1/events/:id/public', () => {
  let t: TestApp
  let eventA: Awaited<ReturnType<typeof createEvent>>
  let eventB: Awaited<ReturnType<typeof createEvent>>
  let viewerToken: string

  beforeAll(async () => {
    t = await createTestApp()
    eventA = await testPrisma().event.update({
      where: { id: (await createEvent({ name: 'Aniversário da Ana' })).id },
      data: {
        endsAt: new Date('2026-11-15T03:00:00.000Z'),
        venueName: 'Espaço Jardim',
        venueAddress: 'Rua das Flores, 100',
        city: 'São Paulo',
        mapsUrl: 'https://maps.app.goo.gl/exemplo',
      },
    })
    eventB = await createEvent()
    const viewer = await createUser({ email: 'viewer@example.com' })
    await addMember({ eventId: eventA.id, userId: viewer.id, role: 'VIEWER' })
    const login = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@example.com', password: 'correct-password' })
    viewerToken = login.body.data.token
  })

  afterAll(() => t.close())

  const read = (eventId: number) => t.http().get(`/api/v1/events/${eventId}/public`)

  it('gives the Site the public part of its Event, and nothing internal', async () => {
    const { value } = await createApiToken({ eventId: eventA.id, scopes: ['event:read'] })

    const res = await read(eventA.id).set('X-Api-Key', value)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      id: eventA.id,
      type: 'WEDDING',
      status: 'ACTIVE',
      name: 'Aniversário da Ana',
      startsAt: '2026-11-14T22:00:00.000Z',
      endsAt: '2026-11-15T03:00:00.000Z',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      currency: 'BRL',
      venueName: 'Espaço Jardim',
      venueAddress: 'Rua das Flores, 100',
      city: 'São Paulo',
      mapsUrl: 'https://maps.app.goo.gl/exemplo',
    })
  })

  it('refuses a token of event A on event B with 403, and never learns it exists', async () => {
    const { value } = await createApiToken({ eventId: eventA.id, scopes: ['event:read'] })

    for (const eventId of [eventB.id, 999_999]) {
      const res = await read(eventId).set('X-Api-Key', value)
      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    }
  })

  it('refuses a token without the Scope event:read with 403 INSUFFICIENT_SCOPE', async () => {
    const { value } = await createApiToken({ eventId: eventA.id, scopes: ['rsvp:create'] })

    const res = await read(eventA.id).set('X-Api-Key', value)
    expect(res.status).toBe(403)
    expect(res.body).toEqual(error('INSUFFICIENT_SCOPE'))
  })

  it('refuses a missing, unknown or inactive token alike, with 401', async () => {
    const { value } = await createApiToken({ eventId: eventA.id, isActive: false })

    for (const res of [
      await read(eventA.id),
      await read(eventA.id).set('X-Api-Key', 'evt_unknown'),
      await read(eventA.id).set('X-Api-Key', value),
    ]) {
      expect(res.status).toBe(401)
      expect(res.body).toEqual(error('UNAUTHENTICATED'))
    }
  })

  it('does not take the API token in Authorization, nor on the routes of members', async () => {
    const { value } = await createApiToken({ eventId: eventA.id, scopes: ['event:read'] })

    const inAuthorization = await read(eventA.id).auth(value, { type: 'bearer' })
    const memberRoute = await t.http().get(`/api/v1/events/${eventA.id}`).set('X-Api-Key', value)
    for (const res of [inAuthorization, memberRoute]) {
      expect(res.status).toBe(401)
      expect(res.body).toEqual(error('UNAUTHENTICATED'))
    }
  })

  it('keeps answering the Site of an Archived event', async () => {
    const archived = await createEvent({ status: 'ARCHIVED' })
    const { value } = await createApiToken({ eventId: archived.id, scopes: ['event:read'] })

    const res = await read(archived.id).set('X-Api-Key', value)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ARCHIVED')
  })

  it('lets a member preview what the Site reads, with their JWT', async () => {
    const res = await read(eventA.id).auth(viewerToken, { type: 'bearer' })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Aniversário da Ana')
  })

  it('stores the last use of the token, and not as an edit', async () => {
    const created = await createApiToken({ eventId: eventA.id, scopes: ['event:read'] })

    await read(eventA.id).set('X-Api-Key', created.value)

    const row = await testPrisma().apiToken.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.lastUsedAt).not.toBeNull()
    expect(row.updatedAt).toEqual(created.updatedAt)
  })
})
