import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { addMember, createActivationLink, createEvent, createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

type Who = 'admin' | 'primary' | 'organizer' | 'manager' | 'viewer' | 'stranger'

describe('Event members', () => {
  let t: TestApp
  const tokens = {} as Record<Who, string>
  const ids = {} as Record<Who, number>
  let eventId: number

  beforeAll(async () => {
    t = await createTestApp()
    const names: Who[] = ['admin', 'primary', 'organizer', 'manager', 'viewer', 'stranger']
    for (const name of names) {
      const user = await createUser({
        name: `The ${name}`,
        email: `${name}@example.com`,
        role: name === 'admin' ? 'SUPER_ADMIN' : 'USER',
      })
      ids[name] = user.id
      tokens[name] = await loginAs(`${name}@example.com`)
    }
  })

  // Every test starts from the same Event, so no test depends on another's changes.
  beforeEach(async () => {
    const event = await createEvent()
    eventId = event.id
    await addMember({ eventId, userId: ids.primary, role: 'OWNER', isPrimaryOwner: true })
    await addMember({ eventId, userId: ids.organizer, role: 'OWNER' })
    await addMember({ eventId, userId: ids.manager, role: 'MANAGER' })
    await addMember({ eventId, userId: ids.viewer, role: 'VIEWER' })
  })

  afterAll(() => t.close())

  async function loginAs(email: string): Promise<string> {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'correct-password' })
    return res.body.data.token as string
  }

  async function members() {
    const rows = await testPrisma().eventMember.findMany({
      where: { eventId },
      orderBy: { id: 'asc' },
    })
    return rows.map((m) => [m.userId, m.role, m.isPrimaryOwner])
  }

  describe('GET /api/v1/events/:id/members', () => {
    it('shows every member to a Viewer', async () => {
      const res = await t
        .http()
        .get(`/api/v1/events/${eventId}/members`)
        .auth(tokens.viewer, { type: 'bearer' })

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([
        {
          userId: ids.primary,
          name: 'The primary',
          email: 'primary@example.com',
          role: 'OWNER',
          isPrimaryOwner: true,
          pending: false,
        },
        expect.objectContaining({ userId: ids.organizer, role: 'OWNER', isPrimaryOwner: false }),
        expect.objectContaining({ userId: ids.manager, role: 'MANAGER' }),
        expect.objectContaining({ userId: ids.viewer, role: 'VIEWER' }),
      ])
    })

    it('refuses a User of no Event with 403', async () => {
      const res = await t
        .http()
        .get(`/api/v1/events/${eventId}/members`)
        .auth(tokens.stranger, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })

    it('refuses an anonymous request with 401', async () => {
      const res = await t.http().get(`/api/v1/events/${eventId}/members`)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/events/:id/members', () => {
    it('creates a Pending user for a new email and returns the activationToken', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.organizer, { type: 'bearer' })
        .send({ email: 'Joao@X.com', name: 'João', role: 'OWNER' })

      expect(res.status).toBe(201)
      expect(res.body.data).toEqual({
        userId: expect.any(Number),
        name: 'João',
        email: 'joao@x.com',
        role: 'OWNER',
        isPrimaryOwner: false,
        pending: true,
        activation: { activationToken: expect.any(String), expiresAt: expect.any(String) },
      })
      const link = await t
        .http()
        .post('/api/v1/auth/activate')
        .send({ token: res.body.data.activation.activationToken, password: 'Nova-senha1' })
      expect(link.status).toBe(200)

      const row = await testPrisma().eventMember.findFirstOrThrow({
        where: { eventId, userId: res.body.data.userId },
      })
      expect(row.createdById).toBe(ids.organizer)
    })

    it('only links an existing User, without an Activation link', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ email: 'stranger@example.com', name: 'Ignored', role: 'VIEWER' })

      expect(res.status).toBe(201)
      expect(res.body.data).toMatchObject({
        userId: ids.stranger,
        name: 'The stranger',
        pending: false,
        activation: null,
      })
    })

    it('refuses an existing member with 409 MEMBER_ALREADY_EXISTS', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ email: 'manager@example.com', name: 'X', role: 'VIEWER' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('MEMBER_ALREADY_EXISTS'))
    })

    it('refuses the Super admin with 409 USER_IS_SUPER_ADMIN', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ email: 'admin@example.com', name: 'X', role: 'OWNER' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('USER_IS_SUPER_ADMIN'))
    })

    it('refuses a Manager with 403', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.manager, { type: 'bearer' })
        .send({ email: 'new@x.com', name: 'X', role: 'VIEWER' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })

    it('requires the role', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ email: 'new@x.com', name: 'X' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('refuses an Owner on an Archived event with 409 EVENT_ARCHIVED', async () => {
      await testPrisma().event.update({ where: { id: eventId }, data: { status: 'ARCHIVED' } })

      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ email: 'new@x.com', name: 'X', role: 'VIEWER' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('EVENT_ARCHIVED'))
    })
  })

  describe('PATCH /api/v1/events/:id/members/:userId', () => {
    it('lets an Owner promote a Viewer to Manager', async () => {
      const res = await t
        .http()
        .patch(`/api/v1/events/${eventId}/members/${ids.viewer}`)
        .auth(tokens.organizer, { type: 'bearer' })
        .send({ role: 'MANAGER' })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ userId: ids.viewer, role: 'MANAGER' })
      expect(await members()).toContainEqual([ids.viewer, 'MANAGER', false])
    })

    it('refuses an Owner organizador demoting the Primary owner with 403', async () => {
      const res = await t
        .http()
        .patch(`/api/v1/events/${eventId}/members/${ids.primary}`)
        .auth(tokens.organizer, { type: 'bearer' })
        .send({ role: 'VIEWER' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })

    it('refuses the Primary owner demoting themselves with 409 PRIMARY_OWNER_MUST_TRANSFER', async () => {
      const res = await t
        .http()
        .patch(`/api/v1/events/${eventId}/members/${ids.primary}`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ role: 'MANAGER' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('PRIMARY_OWNER_MUST_TRANSFER'))
    })

    it('refuses someone who is not a member with 404 MEMBER_NOT_FOUND', async () => {
      const res = await t
        .http()
        .patch(`/api/v1/events/${eventId}/members/${ids.stranger}`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ role: 'VIEWER' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(error('MEMBER_NOT_FOUND'))
    })
  })

  describe('DELETE /api/v1/events/:id/members/:userId', () => {
    it('refuses an Owner organizador removing another Owner with 403', async () => {
      const res = await t
        .http()
        .delete(`/api/v1/events/${eventId}/members/${ids.primary}`)
        .auth(tokens.organizer, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })

    it('lets the Primary owner remove an Owner organizador', async () => {
      const res = await t
        .http()
        .delete(`/api/v1/events/${eventId}/members/${ids.organizer}`)
        .auth(tokens.primary, { type: 'bearer' })

      expect(res.status).toBe(204)
      expect(await members()).not.toContainEqual([ids.organizer, 'OWNER', false])
    })

    it('lets a Viewer leave on their own', async () => {
      const res = await t
        .http()
        .delete(`/api/v1/events/${eventId}/members/${ids.viewer}`)
        .auth(tokens.viewer, { type: 'bearer' })

      expect(res.status).toBe(204)
      expect(await members()).toHaveLength(3)
    })

    it('keeps even the Super admin from removing the Primary owner before a transfer', async () => {
      const res = await t
        .http()
        .delete(`/api/v1/events/${eventId}/members/${ids.primary}`)
        .auth(tokens.admin, { type: 'bearer' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('PRIMARY_OWNER_MUST_TRANSFER'))
    })

    it('drops the Activation link of a Pending user left with no Event', async () => {
      const pending = await createUser({ email: 'pending@example.com', password: null })
      await addMember({ eventId, userId: pending.id, role: 'VIEWER' })
      const link = await createActivationLink({ userId: pending.id })

      const res = await t
        .http()
        .delete(`/api/v1/events/${eventId}/members/${pending.id}`)
        .auth(tokens.primary, { type: 'bearer' })

      expect(res.status).toBe(204)
      const activate = await t
        .http()
        .post('/api/v1/auth/activate')
        .send({ token: link.token, password: 'Nova-senha1' })
      expect(activate.body).toEqual(error('ACTIVATION_LINK_INVALID'))
    })
  })

  describe('POST /api/v1/events/:id/members/transfer-primary', () => {
    it('hands the post to another Owner; the former stays on as Owner organizador', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members/transfer-primary`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ userId: ids.organizer })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(4)
      expect(await members()).toEqual([
        [ids.primary, 'OWNER', false],
        [ids.organizer, 'OWNER', true],
        [ids.manager, 'MANAGER', false],
        [ids.viewer, 'VIEWER', false],
      ])
    })

    it('lets the Super admin name the Primary owner of an Event that has none', async () => {
      const event = await createEvent()
      await addMember({ eventId: event.id, userId: ids.manager, role: 'OWNER' })

      const res = await t
        .http()
        .post(`/api/v1/events/${event.id}/members/transfer-primary`)
        .auth(tokens.admin, { type: 'bearer' })
        .send({ userId: ids.manager })

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([
        expect.objectContaining({ userId: ids.manager, isPrimaryOwner: true }),
      ])
    })

    it('refuses a target who is not an Owner with 409 TRANSFER_TARGET_NOT_OWNER', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members/transfer-primary`)
        .auth(tokens.primary, { type: 'bearer' })
        .send({ userId: ids.manager })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('TRANSFER_TARGET_NOT_OWNER'))
    })

    it('refuses an Owner organizador with 403', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members/transfer-primary`)
        .auth(tokens.organizer, { type: 'bearer' })
        .send({ userId: ids.organizer })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })
  })

  describe('POST /api/v1/events/:id/members/:userId/activation-link', () => {
    it("lets an Owner reissue a Pending member's link", async () => {
      const pending = await createUser({ email: 'pending2@example.com', password: null })
      await addMember({ eventId, userId: pending.id, role: 'VIEWER' })
      const old = await createActivationLink({ userId: pending.id })

      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members/${pending.id}/activation-link`)
        .auth(tokens.organizer, { type: 'bearer' })

      expect(res.status).toBe(201)
      expect(res.body.data).toEqual({
        activationToken: expect.any(String),
        expiresAt: expect.any(String),
      })
      const stale = await t
        .http()
        .post('/api/v1/auth/activate')
        .send({ token: old.token, password: 'Nova-senha1' })
      expect(stale.body).toEqual(error('ACTIVATION_LINK_INVALID'))
    })

    it('refuses an active member with 409 USER_ALREADY_ACTIVE', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members/${ids.manager}/activation-link`)
        .auth(tokens.primary, { type: 'bearer' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('USER_ALREADY_ACTIVE'))
    })

    it('refuses a Viewer with 403', async () => {
      const res = await t
        .http()
        .post(`/api/v1/events/${eventId}/members/${ids.manager}/activation-link`)
        .auth(tokens.viewer, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })
  })
})
