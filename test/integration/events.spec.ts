import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { addMember, createEvent, createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

describe('Events', () => {
  let t: TestApp
  const tokens: Record<'admin' | 'owner' | 'manager' | 'viewer' | 'stranger', string> = {
    admin: '',
    owner: '',
    manager: '',
    viewer: '',
    stranger: '',
  }
  let ownerId: number
  let managerId: number
  let viewerId: number
  let pendingId: number
  let adminId: number

  beforeAll(async () => {
    t = await createTestApp()
    adminId = (await createUser({ email: 'admin@example.com', role: 'SUPER_ADMIN' })).id
    ownerId = (await createUser({ email: 'owner@example.com' })).id
    managerId = (await createUser({ email: 'manager@example.com' })).id
    viewerId = (await createUser({ email: 'viewer@example.com' })).id
    await createUser({ email: 'stranger@example.com' })
    pendingId = (await createUser({ email: 'pending@example.com', password: null })).id
    for (const name of Object.keys(tokens) as (keyof typeof tokens)[]) {
      tokens[name] = await loginAs(`${name}@example.com`)
    }
  })

  afterAll(() => t.close())

  async function loginAs(email: string, password = 'correct-password'): Promise<string> {
    const res = await t.http().post('/api/v1/auth/login').send({ email, password })
    return res.body.data.token as string
  }

  /** An event where owner, manager and viewer have their roles. */
  async function eventWithMembers(options: Parameters<typeof createEvent>[0] = {}) {
    const event = await createEvent(options)
    await addMember({ eventId: event.id, userId: ownerId, role: 'OWNER', isPrimaryOwner: true })
    await addMember({ eventId: event.id, userId: managerId, role: 'MANAGER' })
    await addMember({ eventId: event.id, userId: viewerId, role: 'VIEWER' })
    return event
  }

  describe('POST /api/v1/events', () => {
    const body = {
      type: 'BIRTHDAY',
      name: 'Aniversário da Ana',
      slug: 'aniversario-da-ana',
      siteUrl: 'https://festa-da-ana.com/',
      startsAt: '2026-11-14T19:00:00-03:00',
      venueName: 'Salão',
    }

    it('lets the Super admin create an Event, with a Pending user as Primary owner', async () => {
      const res = await t
        .http()
        .post('/api/v1/events')
        .auth(tokens.admin, { type: 'bearer' })
        .send({ ...body, primaryOwnerUserId: pendingId })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          id: expect.any(Number),
          type: 'BIRTHDAY',
          status: 'ACTIVE',
          name: 'Aniversário da Ana',
          slug: 'aniversario-da-ana',
          siteUrl: 'https://festa-da-ana.com',
          startsAt: '2026-11-14T22:00:00.000Z',
          endsAt: null,
          timezone: 'America/Sao_Paulo',
          locale: 'pt-BR',
          currency: 'BRL',
          venueName: 'Salão',
          venueAddress: null,
          city: null,
          mapsUrl: null,
          membership: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      })
      const member = await testPrisma().eventMember.findFirst({
        where: { eventId: res.body.data.id },
      })
      expect(member).toMatchObject({ userId: pendingId, role: 'OWNER', isPrimaryOwner: true })
    })

    it('answers 409 SLUG_ALREADY_IN_USE for a duplicated slug', async () => {
      const res = await t
        .http()
        .post('/api/v1/events')
        .auth(tokens.admin, { type: 'bearer' })
        .send(body)

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('SLUG_ALREADY_IN_USE'))
    })

    it('answers 422 PRIMARY_OWNER_INVALID for a Super admin or unknown Primary owner', async () => {
      for (const primaryOwnerUserId of [adminId, 999_999]) {
        const res = await t
          .http()
          .post('/api/v1/events')
          .auth(tokens.admin, { type: 'bearer' })
          .send({ ...body, slug: 'outro-slug', primaryOwnerUserId })

        expect(res.status).toBe(422)
        expect(res.body).toEqual(error('PRIMARY_OWNER_INVALID'))
      }
    })

    it('answers 400 VALIDATION_ERROR for a date without offset, a bad slug, a site with a path or another currency', async () => {
      for (const invalid of [
        { startsAt: '2026-11-14T19:00:00' },
        { slug: 'Com Espaço' },
        { siteUrl: 'https://festa.com/rsvp' },
        { currency: 'USD' },
        { locale: 'en-US' },
        { timezone: 'GMT-3' },
      ]) {
        const res = await t
          .http()
          .post('/api/v1/events')
          .auth(tokens.admin, { type: 'bearer' })
          .send({ ...body, slug: 'valido', ...invalid })

        expect(res.status, JSON.stringify(invalid)).toBe(400)
        expect(res.body.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('answers 403 to anyone but the Super admin, and 401 without a token', async () => {
      const forbidden = await t
        .http()
        .post('/api/v1/events')
        .auth(tokens.owner, { type: 'bearer' })
        .send({ ...body, slug: 'de-um-owner' })
      const anonymous = await t.http().post('/api/v1/events').send(body)

      expect(forbidden.status).toBe(403)
      expect(forbidden.body).toEqual(error('FORBIDDEN'))
      expect(anonymous.status).toBe(401)
    })
  })

  describe('GET /api/v1/events and /:id', () => {
    it('shows members only their Events (archived included, newest first) with their Membership', async () => {
      const old = await eventWithMembers({
        slug: 'lista-antigo',
        status: 'ARCHIVED',
        startsAt: new Date('2020-01-01T12:00:00.000Z'),
      })
      const recent = await eventWithMembers({
        slug: 'lista-recente',
        startsAt: new Date('2030-01-01T12:00:00.000Z'),
      })
      await createEvent({ slug: 'lista-de-ninguem' })

      const res = await t.http().get('/api/v1/events').auth(tokens.manager, { type: 'bearer' })
      const archived = await t
        .http()
        .get('/api/v1/events?status=ARCHIVED')
        .auth(tokens.manager, { type: 'bearer' })

      expect(res.status).toBe(200)
      const ids = res.body.data.map((e: { id: number }) => e.id)
      expect(ids[0]).toBe(recent.id)
      expect(ids.at(-1)).toBe(old.id)
      expect(res.body.data.map((e: { slug: string }) => e.slug)).not.toContain('lista-de-ninguem')
      expect(res.body.data[0].membership).toEqual({ role: 'MANAGER', isPrimaryOwner: false })
      expect(archived.body.data.map((e: { id: number }) => e.id)).toEqual([old.id])
    })

    it('lists every Event to the Super admin, with no Membership', async () => {
      const res = await t.http().get('/api/v1/events').auth(tokens.admin, { type: 'bearer' })
      const all = await testPrisma().event.count()

      expect(res.body.data).toHaveLength(all)
      expect(res.body.data.every((e: { membership: unknown }) => e.membership === null)).toBe(true)
    })

    it('shows an Event to any member; 403 to a non-member even for an unknown id; 404 only to the Super admin', async () => {
      const event = await eventWithMembers()

      const asViewer = await t
        .http()
        .get(`/api/v1/events/${event.id}`)
        .auth(tokens.viewer, { type: 'bearer' })
      const asStranger = await t
        .http()
        .get(`/api/v1/events/${event.id}`)
        .auth(tokens.stranger, { type: 'bearer' })
      const unknownAsStranger = await t
        .http()
        .get('/api/v1/events/999999')
        .auth(tokens.stranger, { type: 'bearer' })
      const unknownAsAdmin = await t
        .http()
        .get('/api/v1/events/999999')
        .auth(tokens.admin, { type: 'bearer' })

      expect(asViewer.status).toBe(200)
      expect(asViewer.body.data.membership).toEqual({ role: 'VIEWER', isPrimaryOwner: false })
      expect(asStranger.status).toBe(403)
      expect(unknownAsStranger.status).toBe(403)
      expect(unknownAsStranger.body).toEqual(error('FORBIDDEN'))
      expect(unknownAsAdmin.status).toBe(404)
    })
  })

  describe('PATCH /api/v1/events/:id', () => {
    it('lets a Manager edit the details; refuses a Viewer with 403', async () => {
      const event = await eventWithMembers()

      const res = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.manager, { type: 'bearer' })
        .send({ name: 'Novo nome', endsAt: '2026-11-15T02:00:00-03:00', city: 'Itatiba' })
      const asViewer = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.viewer, { type: 'bearer' })
        .send({ name: 'X' })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        name: 'Novo nome',
        endsAt: '2026-11-15T05:00:00.000Z',
        city: 'Itatiba',
      })
      expect(asViewer.status).toBe(403)
    })

    it('refuses the whole request of a Manager sending siteUrl; an Owner may change it', async () => {
      const event = await eventWithMembers()

      const asManager = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.manager, { type: 'bearer' })
        .send({ name: 'Não salva', siteUrl: 'https://outro.com' })
      const asOwner = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.owner, { type: 'bearer' })
        .send({ siteUrl: 'https://outro.com' })

      expect(asManager.status).toBe(403)
      // The refused request saved nothing: the Owner's response still has the old name.
      expect(asOwner.status).toBe(200)
      expect(asOwner.body.data.siteUrl).toBe('https://outro.com')
      expect(asOwner.body.data.name).toBe(event.name)
    })

    it('refuses slug, currency and status changes with 400', async () => {
      const event = await eventWithMembers()

      for (const change of [{ slug: 'novo' }, { currency: 'BRL' }, { status: 'ARCHIVED' }]) {
        const res = await t
          .http()
          .patch(`/api/v1/events/${event.id}`)
          .auth(tokens.owner, { type: 'bearer' })
          .send(change)
        expect(res.status, JSON.stringify(change)).toBe(400)
      }
    })

    it('refuses an end before the stored start with 400', async () => {
      const event = await eventWithMembers()

      const res = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.owner, { type: 'bearer' })
        .send({ endsAt: '2026-11-14T21:00:00Z' })

      expect(res.status).toBe(400)
    })
  })

  describe('archive and unarchive', () => {
    it('lets an Owner archive (idempotently), freezing the Event for members', async () => {
      const event = await eventWithMembers()

      const asManager = await t
        .http()
        .post(`/api/v1/events/${event.id}/archive`)
        .auth(tokens.manager, { type: 'bearer' })
      const first = await t
        .http()
        .post(`/api/v1/events/${event.id}/archive`)
        .auth(tokens.owner, { type: 'bearer' })
      const again = await t
        .http()
        .post(`/api/v1/events/${event.id}/archive`)
        .auth(tokens.owner, { type: 'bearer' })
      const editByOwner = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.owner, { type: 'bearer' })
        .send({ name: 'X' })
      const editByViewer = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.viewer, { type: 'bearer' })
        .send({ name: 'X' })
      const siteByManager = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.manager, { type: 'bearer' })
        .send({ siteUrl: 'https://outro.com' })
      const read = await t
        .http()
        .get(`/api/v1/events/${event.id}`)
        .auth(tokens.viewer, { type: 'bearer' })
      const editByAdmin = await t
        .http()
        .patch(`/api/v1/events/${event.id}`)
        .auth(tokens.admin, { type: 'bearer' })
        .send({ name: 'Corrigido' })

      expect(asManager.status).toBe(403)
      expect(first.status).toBe(200)
      expect(first.body.data.status).toBe('ARCHIVED')
      expect(again.status).toBe(200)
      expect(again.body.data.updatedAt).toBe(first.body.data.updatedAt)
      expect(editByOwner.status).toBe(409)
      expect(editByOwner.body).toEqual(error('EVENT_ARCHIVED'))
      expect(editByViewer.status).toBe(403)
      expect(siteByManager.status).toBe(403)
      expect(read.status).toBe(200)
      expect(editByAdmin.status).toBe(200)
      expect(editByAdmin.body.data.name).toBe('Corrigido')
    })

    it('lets only the Super admin unarchive, idempotently', async () => {
      const event = await eventWithMembers({ status: 'ARCHIVED' })

      const asOwner = await t
        .http()
        .post(`/api/v1/events/${event.id}/unarchive`)
        .auth(tokens.owner, { type: 'bearer' })
      const first = await t
        .http()
        .post(`/api/v1/events/${event.id}/unarchive`)
        .auth(tokens.admin, { type: 'bearer' })
      const again = await t
        .http()
        .post(`/api/v1/events/${event.id}/unarchive`)
        .auth(tokens.admin, { type: 'bearer' })

      expect(asOwner.status).toBe(403)
      expect(first.status).toBe(200)
      expect(first.body.data.status).toBe('ACTIVE')
      expect(again.status).toBe(200)
    })
  })

  describe('database constraints (ADR-0003)', () => {
    it('allows at most one Primary owner per Event, and only as Owner', async () => {
      const event = await eventWithMembers()
      const other = await createUser()

      await expect(
        addMember({ eventId: event.id, userId: other.id, role: 'OWNER', isPrimaryOwner: true }),
      ).rejects.toThrow()
      await expect(
        addMember({ eventId: event.id, userId: other.id, role: 'MANAGER', isPrimaryOwner: true }),
      ).rejects.toThrow()
      await expect(
        addMember({ eventId: event.id, userId: other.id, role: 'OWNER' }),
      ).resolves.toBeDefined()
    })
  })
})
