import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Clock } from '../../src/shared/application/clock.js'
import { FixedClock } from '../../src/shared/application/testing/fixed-clock.js'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import {
  createEvent,
  createGroup,
  createGroupMember,
  createUser,
  sessionTokenFor,
} from './support/factories.js'

function errorOf(code: string) {
  return { error: { code, message: expect.any(String) } }
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const MANAUS_PERIOD = { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' }
// 22:30 of the 16th in Manaus (UTC-4), already the 17th in UTC: the last day of the Manaus trip.
const LAST_DAY_IN_MANAUS = new Date('2026-11-17T02:30:00.000Z')

describe('Events', () => {
  let t: TestApp
  const clock = new FixedClock(LAST_DAY_IN_MANAUS)
  let adminToken: string
  let groupId: number
  let otherGroupId: number
  let ownerId: number
  let ownerToken: string
  let viewerToken: string
  let outsiderToken: string

  beforeAll(async () => {
    t = await createTestApp({
      override: (builder) => builder.overrideProvider(Clock).useValue(clock),
    })
    const admin = await createUser({ email: 'admin.events@example.com', role: 'SUPER_ADMIN' })
    adminToken = sessionTokenFor(admin)
  })

  beforeEach(async () => {
    clock.set(LAST_DAY_IN_MANAUS)
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    groupId = (await createGroup({ name: 'Vocal Livre' })).id
    otherGroupId = (await createGroup({ name: 'Outro' })).id
    const owner = await createUser()
    const viewer = await createUser()
    const outsider = await createUser()
    ownerId = owner.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    // An Owner, but of another Group.
    await createGroupMember({ groupId: otherGroupId, userId: outsider.id, role: 'OWNER' })
    ownerToken = sessionTokenFor(owner)
    viewerToken = sessionTokenFor(viewer)
    outsiderToken = sessionTokenFor(outsider)
  })

  afterAll(() => t.close())

  const groupEventsUrl = (id = groupId) => `/api/v1/groups/${id}/events`
  const eventUrl = (id: number) => `/api/v1/events/${id}`

  describe('POST /api/v1/groups/:id/events', () => {
    const body = { name: '  Shows em Manaus ', place: ' Manaus - AM ', period: MANAUS_PERIOD }

    it('lets an Owner create an Event in Draft, with the period as written, as its Author', async () => {
      const res = await t
        .http()
        .post(groupEventsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send(body)

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          id: expect.any(Number),
          groupId,
          name: 'Shows em Manaus',
          place: 'Manaus - AM',
          period: MANAUS_PERIOD,
          state: 'DRAFT',
          isFinished: false,
          createdAt: LAST_DAY_IN_MANAUS.toISOString(),
          updatedAt: LAST_DAY_IN_MANAUS.toISOString(),
        },
      })
      const row = await testPrisma().event.findUniqueOrThrow({ where: { id: res.body.data.id } })
      expect(row).toMatchObject({ createdById: ownerId, updatedById: ownerId, state: 'DRAFT' })
    })

    it('lets the Super admin create an Event in any Group', async () => {
      const res = await t
        .http()
        .post(groupEventsUrl())
        .auth(adminToken, { type: 'bearer' })
        .send(body)

      expect(res.status).toBe(201)
    })

    it('answers 400 EVENT_PERIOD_INVALID when the end date is before the start date', async () => {
      const res = await t
        .http()
        .post(groupEventsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ ...body, period: { ...MANAUS_PERIOD, endDate: '2026-11-12' } })

      expect(res.status).toBe(400)
      expect(res.body).toEqual(errorOf('EVENT_PERIOD_INVALID'))
      expect(await testPrisma().event.count()).toBe(0)
    })

    it.each([
      ['a date with a time', { ...MANAUS_PERIOD, startDate: '2026-11-13T10:00:00Z' }],
      ['a date the calendar does not have', { ...MANAUS_PERIOD, endDate: '2026-11-31' }],
      ['an offset instead of an IANA zone', { ...MANAUS_PERIOD, timezone: '-04:00' }],
      ['a zone that does not exist', { ...MANAUS_PERIOD, timezone: 'America/Atlantida' }],
    ])('answers 400 VALIDATION_ERROR for %s', async (_, period) => {
      const res = await t
        .http()
        .post(groupEventsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ ...body, period })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 403 to a Viewer and 404 to who is not a Group member of the Group', async () => {
      const asViewer = await t
        .http()
        .post(groupEventsUrl())
        .auth(viewerToken, { type: 'bearer' })
        .send(body)
      const asOutsider = await t
        .http()
        .post(groupEventsUrl())
        .auth(outsiderToken, { type: 'bearer' })
        .send(body)

      expect(asViewer.status).toBe(403)
      expect(asViewer.body).toEqual(errorOf('FORBIDDEN'))
      expect(asOutsider.status).toBe(404)
      expect(asOutsider.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('answers 404 for a Group that does not exist', async () => {
      const res = await t
        .http()
        .post(groupEventsUrl(groupId + 1000))
        .auth(adminToken, { type: 'bearer' })
        .send(body)

      expect(res.status).toBe(404)
    })

    it('answers 401 without a token', async () => {
      expect((await t.http().post(groupEventsUrl()).send(body)).status).toBe(401)
    })
  })

  describe('GET /api/v1/groups/:id/events', () => {
    it('lists the Events of the Group to a Viewer, by start date, with state and whether each is finished', async () => {
      await createEvent({ groupId, name: 'Shows em Manaus', ...MANAUS_PERIOD })
      await createEvent({
        groupId,
        name: 'Ensaio',
        place: 'Sede',
        startDate: '2026-11-05',
        endDate: '2026-11-05',
        timezone: 'America/Sao_Paulo',
      })
      await createEvent({ groupId: otherGroupId, name: 'De outro Group' })

      const res = await t.http().get(groupEventsUrl()).auth(viewerToken, { type: 'bearer' })

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([
        expect.objectContaining({
          name: 'Ensaio',
          place: 'Sede',
          period: { startDate: '2026-11-05', endDate: '2026-11-05', timezone: 'America/Sao_Paulo' },
          state: 'DRAFT',
          isFinished: true,
        }),
        expect.objectContaining({
          name: 'Shows em Manaus',
          place: 'Manaus - AM',
          period: MANAUS_PERIOD,
          state: 'DRAFT',
          isFinished: false,
        }),
      ])
      expect(res.body.data[0].createdAt).toMatch(ISO_UTC)
    })

    it('answers 404 to who is not a Group member of the Group', async () => {
      const res = await t.http().get(groupEventsUrl()).auth(outsiderToken, { type: 'bearer' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('answers 401 without a token', async () => {
      expect((await t.http().get(groupEventsUrl())).status).toBe(401)
    })
  })

  describe('GET /api/v1/events/:id', () => {
    it('shows the Event to a Viewer of its Group, finished once the end date passes in its zone', async () => {
      const event = await createEvent({ groupId, name: 'Shows em Manaus', ...MANAUS_PERIOD })

      const lastDay = await t.http().get(eventUrl(event.id)).auth(viewerToken, { type: 'bearer' })
      // 00:00 of the 17th in Manaus.
      clock.set(new Date('2026-11-17T04:00:00.000Z'))
      const dayAfter = await t.http().get(eventUrl(event.id)).auth(viewerToken, { type: 'bearer' })

      expect(lastDay.status).toBe(200)
      expect(lastDay.body.data).toMatchObject({
        id: event.id,
        groupId,
        name: 'Shows em Manaus',
        period: MANAUS_PERIOD,
        state: 'DRAFT',
        isFinished: false,
      })
      expect(dayAfter.body.data.isFinished).toBe(true)
    })

    it('answers 404 to who is not a Group member of its Group, and for an Event that does not exist', async () => {
      const event = await createEvent({ groupId })

      const asOutsider = await t
        .http()
        .get(eventUrl(event.id))
        .auth(outsiderToken, { type: 'bearer' })
      const missing = await t
        .http()
        .get(eventUrl(event.id + 1000))
        .auth(adminToken, { type: 'bearer' })

      expect(asOutsider.status).toBe(404)
      expect(asOutsider.body).toEqual(errorOf('NOT_FOUND'))
      expect(missing.status).toBe(404)
    })

    it('answers 401 without a token', async () => {
      const event = await createEvent({ groupId })

      expect((await t.http().get(eventUrl(event.id))).status).toBe(401)
    })
  })

  describe('PATCH /api/v1/events/:id', () => {
    it('lets an Owner edit name, place and period of a Finished event, as its Author', async () => {
      const event = await createEvent({ groupId, name: 'Ensaio', startDate: '2026-11-05' })
      const period = {
        startDate: '2026-11-06',
        endDate: '2026-11-07',
        timezone: 'America/Sao_Paulo',
      }

      const res = await t
        .http()
        .patch(eventUrl(event.id))
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Ensaio geral', place: 'Sede', period })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        id: event.id,
        name: 'Ensaio geral',
        place: 'Sede',
        period,
        state: 'DRAFT',
        isFinished: true,
        updatedAt: LAST_DAY_IN_MANAUS.toISOString(),
      })
      const row = await testPrisma().event.findUniqueOrThrow({ where: { id: event.id } })
      expect(row).toMatchObject({ name: 'Ensaio geral', updatedById: ownerId, createdById: null })
    })

    it('changes only what is sent', async () => {
      const event = await createEvent({ groupId, name: 'Shows em Manaus', ...MANAUS_PERIOD })

      const res = await t
        .http()
        .patch(eventUrl(event.id))
        .auth(ownerToken, { type: 'bearer' })
        .send({ place: 'Teatro Amazonas' })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        name: 'Shows em Manaus',
        place: 'Teatro Amazonas',
        period: MANAUS_PERIOD,
      })
    })

    it('answers 400 EVENT_PERIOD_INVALID when the end date is before the start date', async () => {
      const event = await createEvent({ groupId, ...MANAUS_PERIOD })

      const res = await t
        .http()
        .patch(eventUrl(event.id))
        .auth(ownerToken, { type: 'bearer' })
        .send({ period: { ...MANAUS_PERIOD, startDate: '2026-11-17' } })

      expect(res.status).toBe(400)
      expect(res.body).toEqual(errorOf('EVENT_PERIOD_INVALID'))
    })

    it('answers 400 VALIDATION_ERROR to an empty body', async () => {
      const event = await createEvent({ groupId })

      const res = await t
        .http()
        .patch(eventUrl(event.id))
        .auth(ownerToken, { type: 'bearer' })
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 403 to a Viewer and 404 to who is not a Group member of its Group', async () => {
      const event = await createEvent({ groupId, name: 'Ensaio' })

      const asViewer = await t
        .http()
        .patch(eventUrl(event.id))
        .auth(viewerToken, { type: 'bearer' })
        .send({ name: 'Outro' })
      const asOutsider = await t
        .http()
        .patch(eventUrl(event.id))
        .auth(outsiderToken, { type: 'bearer' })
        .send({ name: 'Outro' })

      expect(asViewer.status).toBe(403)
      expect(asViewer.body).toEqual(errorOf('FORBIDDEN'))
      expect(asOutsider.status).toBe(404)
      const row = await testPrisma().event.findUniqueOrThrow({ where: { id: event.id } })
      expect(row.name).toBe('Ensaio')
    })

    it('answers 401 without a token', async () => {
      const event = await createEvent({ groupId })

      expect((await t.http().patch(eventUrl(event.id)).send({ name: 'Outro' })).status).toBe(401)
    })
  })
})
