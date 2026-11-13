import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaUnitOfWork } from '../../src/shared/infrastructure/prisma-unit-of-work.js'
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

describe('Event items and the schedule', () => {
  let t: TestApp
  let adminToken: string
  let ownerId: number
  let ownerToken: string
  let viewerToken: string
  let outsiderToken: string
  let eventId: number
  let otherEventId: number

  beforeAll(async () => {
    t = await createTestApp()
    const admin = await createUser({ email: 'admin.items@example.com', role: 'SUPER_ADMIN' })
    adminToken = sessionTokenFor(admin)
  })

  beforeEach(async () => {
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    const groupId = (await createGroup({ name: 'Vocal Livre' })).id
    const otherGroupId = (await createGroup({ name: 'Outro' })).id
    const owner = await createUser()
    const viewer = await createUser()
    const outsider = await createUser()
    ownerId = owner.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    await createGroupMember({ groupId: otherGroupId, userId: outsider.id, role: 'OWNER' })
    ownerToken = sessionTokenFor(owner)
    viewerToken = sessionTokenFor(viewer)
    outsiderToken = sessionTokenFor(outsider)
    // The Manaus trip, 13 to 16 of November, in the zone of Manaus.
    eventId = (
      await createEvent({
        groupId,
        name: 'Shows em Manaus',
        startDate: '2026-11-13',
        endDate: '2026-11-16',
        timezone: 'America/Manaus',
      })
    ).id
    otherEventId = (await createEvent({ groupId })).id
  })

  afterAll(() => t.close())

  const itemsUrl = (id = eventId) => `/api/v1/events/${id}/items`
  const itemUrl = (itemId: number, id = eventId) => `/api/v1/events/${id}/items/${itemId}`
  const scheduleUrl = (id = eventId) => `/api/v1/events/${id}/schedule`

  async function createItem(body: Record<string, unknown>, token = ownerToken) {
    return t.http().post(itemsUrl()).auth(token, { type: 'bearer' }).send(body)
  }

  describe('POST /api/v1/events/:id/items', () => {
    it('lets an Owner create a published Event item, with date and time as written, as its Author', async () => {
      const res = await createItem({
        name: ' Passagem de som ',
        date: '2026-11-14',
        time: '15:00',
        place: { name: 'Teatro Amazonas', address: 'Largo de São Sebastião, s/n' },
      })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          id: expect.any(Number),
          eventId,
          name: 'Passagem de som',
          when: { date: '2026-11-14', time: '15:00', timezone: 'America/Manaus' },
          place: {
            name: 'Teatro Amazonas',
            address: 'Largo de São Sebastião, s/n',
            timezone: null,
          },
          state: 'PUBLISHED',
          createdAt: expect.stringMatching(ISO_UTC),
          updatedAt: expect.stringMatching(ISO_UTC),
        },
      })
      const row = await testPrisma().eventItem.findUniqueOrThrow({
        where: { id: res.body.data.id },
      })
      expect(row).toMatchObject({ createdById: ownerId, updatedById: ownerId, time: '15:00' })
    })

    it('keeps the zone of the place, never converting the time', async () => {
      const res = await createItem({
        name: 'Técnica viaja para Manaus',
        date: '2026-11-12',
        time: '08:00',
        place: { name: 'Aeroporto de Guarulhos', timezone: 'America/Sao_Paulo' },
      })

      expect(res.status).toBe(201)
      expect(res.body.data.when).toEqual({
        date: '2026-11-12',
        time: '08:00',
        timezone: 'America/Sao_Paulo',
      })
    })

    it('creates an item of the General info, with no date', async () => {
      const res = await createItem({ name: 'O que levar' })

      expect(res.status).toBe(201)
      expect(res.body.data).toMatchObject({ when: null, place: null })
    })

    it('answers 400 EVENT_ITEM_TIME_WITHOUT_DATE to a time with no date', async () => {
      const res = await createItem({ name: 'Show', time: '19:00' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual(errorOf('EVENT_ITEM_TIME_WITHOUT_DATE'))
      expect(await testPrisma().eventItem.count()).toBe(0)
    })

    it('answers 400 VALIDATION_ERROR to a time out of HH:mm, a bad zone or an empty place', async () => {
      for (const body of [
        { name: 'Show', date: '2026-11-14', time: '7:00' },
        { name: 'Show', place: { timezone: 'Manaus' } },
        { name: 'Show', place: { name: '  ' } },
      ]) {
        const res = await createItem(body)
        expect(res.status).toBe(400)
        expect(res.body.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('lets the Super admin create an Event item', async () => {
      const res = await createItem({ name: 'O que levar' }, adminToken)

      expect(res.status).toBe(201)
    })

    it('answers 403 to a Viewer and 404 to who is not a Group member, or for an unknown Event', async () => {
      expect((await createItem({ name: 'Show' }, viewerToken)).status).toBe(403)
      expect((await createItem({ name: 'Show' }, outsiderToken)).status).toBe(404)
      const unknown = await t
        .http()
        .post(itemsUrl(999_999))
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Show' })
      expect(unknown.status).toBe(404)
    })

    it('answers 401 with no token', async () => {
      const res = await t.http().post(itemsUrl()).send({ name: 'Show' })

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/v1/events/:id/items/:itemId', () => {
    let itemId: number

    beforeEach(async () => {
      itemId = (await createItem({ name: 'Passagem de som', date: '2026-11-14', time: '15:00' }))
        .body.data.id
    })

    function patch(body: Record<string, unknown>, token = ownerToken, url = itemUrl(itemId)) {
      return t.http().patch(url).auth(token, { type: 'bearer' }).send(body)
    }

    it('lets an Owner change what is sent, keeping the rest', async () => {
      const res = await patch({ time: '16:00', place: { timezone: 'America/Manaus' } })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        name: 'Passagem de som',
        when: { date: '2026-11-14', time: '16:00', timezone: 'America/Manaus' },
        place: { name: null, address: null, timezone: 'America/Manaus' },
      })
    })

    it('clears date and time together, moving the item to the General info', async () => {
      const res = await patch({ date: null, time: null })

      expect(res.status).toBe(200)
      expect(res.body.data.when).toBeNull()
    })

    it('answers 400 EVENT_ITEM_TIME_WITHOUT_DATE when only the date is cleared', async () => {
      const res = await patch({ date: null })

      expect(res.status).toBe(400)
      expect(res.body).toEqual(errorOf('EVENT_ITEM_TIME_WITHOUT_DATE'))
    })

    it('answers 400 VALIDATION_ERROR to an empty body', async () => {
      expect((await patch({})).status).toBe(400)
    })

    it('answers 403 to a Viewer, and 404 for an item of another Event or to who is not a Group member', async () => {
      expect((await patch({ name: 'Som' }, viewerToken)).status).toBe(403)
      expect((await patch({ name: 'Som' }, outsiderToken)).status).toBe(404)
      expect((await patch({ name: 'Som' }, ownerToken, itemUrl(itemId, otherEventId))).status).toBe(
        404,
      )
    })
  })

  describe('DELETE /api/v1/events/:id/items/:itemId', () => {
    let itemId: number

    beforeEach(async () => {
      itemId = (await createItem({ name: 'O que levar' })).body.data.id
    })

    it('lets an Owner delete an Event item', async () => {
      const res = await t.http().delete(itemUrl(itemId)).auth(ownerToken, { type: 'bearer' })

      expect(res.status).toBe(204)
      expect(await testPrisma().eventItem.count()).toBe(0)
    })

    it('answers 403 to a Viewer, keeping the item', async () => {
      const res = await t.http().delete(itemUrl(itemId)).auth(viewerToken, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(await testPrisma().eventItem.count()).toBe(1)
    })

    it('answers 404 for an item of another Event', async () => {
      const res = await t
        .http()
        .delete(itemUrl(itemId, otherEventId))
        .auth(ownerToken, { type: 'bearer' })

      expect(res.status).toBe(404)
    })

    // Each write locks the item's row: the ones that come after find it gone.
    it('answers 404, never 500, to concurrent deletes of the same item', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          t.http().delete(itemUrl(itemId)).auth(ownerToken, { type: 'bearer' }),
        ),
      )

      expect(results.map((r) => r.status).sort()).toEqual([204, 404, 404, 404, 404])
      expect(await testPrisma().eventItem.count()).toBe(0)
    })

    // A delete in progress holds the row: the writes queued on it find it gone, not a 500.
    it('answers 404 to a delete and an edit that wait on a delete in progress of the same item', async () => {
      const unitOfWork = t.app.get(PrismaUnitOfWork)
      let release!: () => void
      const released = new Promise<void>((resolve) => (release = resolve))
      let deleted!: () => void
      const hasDeleted = new Promise<void>((resolve) => (deleted = resolve))

      const deleting = unitOfWork.run(async () => {
        await unitOfWork.transaction().eventItem.delete({ where: { id: itemId } })
        deleted()
        await released
      })
      await hasDeleted
      const queued = Promise.all([
        t.http().delete(itemUrl(itemId)).auth(ownerToken, { type: 'bearer' }),
        t.http().patch(itemUrl(itemId)).auth(ownerToken, { type: 'bearer' }).send({ name: 'x' }),
      ])
      // Long enough for both to reach the row and wait on its lock.
      await new Promise((resolve) => setTimeout(resolve, 300))
      release()
      await deleting
      const [deleteRes, patchRes] = await queued

      expect(deleteRes.status).toBe(404)
      expect(deleteRes.body).toEqual(errorOf('NOT_FOUND'))
      expect(patchRes.status).toBe(404)
      expect(patchRes.body).toEqual(errorOf('NOT_FOUND'))
    })
  })

  describe('with the Event Cancelled', () => {
    const cancelUrl = (action: 'cancel' | 'uncancel') => `/api/v1/events/${eventId}/${action}`

    it('freezes creating, editing and deleting its items with 409 EVENT_CANCELLED, until it is uncancelled', async () => {
      const itemId = (await createItem({ name: 'O que levar' })).body.data.id as number
      await t.http().post(cancelUrl('cancel')).auth(ownerToken, { type: 'bearer' }).expect(200)

      const refused409 = await createItem({ name: 'Bis' })
      expect(refused409.status).toBe(409)
      expect(refused409.body).toEqual(errorOf('EVENT_CANCELLED'))
      await t
        .http()
        .patch(itemUrl(itemId))
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Outro nome' })
        .expect(409)
        .expect((res) => expect(res.body).toEqual(errorOf('EVENT_CANCELLED')))
      await t
        .http()
        .delete(itemUrl(itemId))
        .auth(adminToken, { type: 'bearer' })
        .expect(409)
        .expect((res) => expect(res.body).toEqual(errorOf('EVENT_CANCELLED')))
      const kept = await testPrisma().eventItem.findMany({ where: { eventId } })
      expect(kept.map((i) => i.name)).toEqual(['O que levar'])

      await t.http().post(cancelUrl('uncancel')).auth(ownerToken, { type: 'bearer' }).expect(200)
      await t
        .http()
        .patch(itemUrl(itemId))
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Outro nome' })
        .expect(200)
    })

    it('answers a Viewer with 403 before the 409, as for an Event that is not Cancelled', async () => {
      await t.http().post(cancelUrl('cancel')).auth(ownerToken, { type: 'bearer' }).expect(200)

      const refused403 = await createItem({ name: 'Bis' }, viewerToken)
      expect(refused403.status).toBe(403)
      expect(refused403.body).toEqual(errorOf('FORBIDDEN'))
    })
  })

  describe('GET /api/v1/events/:id/schedule', () => {
    beforeEach(async () => {
      // Created out of order, as the production would.
      for (const body of [
        { name: 'O que levar' },
        { name: 'Show no Teatro Amazonas', date: '2026-11-14', time: '19:00' },
        { name: 'Translado para o hotel', date: '2026-11-15', time: '00:40' },
        { name: 'Passagem de som', date: '2026-11-14', time: '15:00' },
        { name: 'Almoço (horário a confirmar)', date: '2026-11-14' },
        {
          name: 'Técnica viaja para Manaus',
          date: '2026-11-12',
          time: '08:00',
          place: { name: 'Aeroporto de Guarulhos', timezone: 'America/Sao_Paulo' },
        },
        { name: 'Contatos da produção' },
      ]) {
        expect((await createItem(body)).status).toBe(201)
      }
    })

    it('gives an Owner the General info and the Timeline, by calendar day, untimed first', async () => {
      const res = await t.http().get(scheduleUrl()).auth(ownerToken, { type: 'bearer' })

      expect(res.status).toBe(200)
      const { generalInfo, timeline } = res.body.data
      expect(generalInfo.map((i: { name: string }) => i.name)).toEqual([
        'O que levar',
        'Contatos da produção',
      ])
      expect(
        timeline.map((day: { date: string; items: { name: string }[] }) => [
          day.date,
          day.items.map((i) => i.name),
        ]),
      ).toEqual([
        // The eve of the period: on the eve.
        ['2026-11-12', ['Técnica viaja para Manaus']],
        [
          '2026-11-14',
          ['Almoço (horário a confirmar)', 'Passagem de som', 'Show no Teatro Amazonas'],
        ],
        // The 00:40 transfer after Saturday's show: on Sunday.
        ['2026-11-15', ['Translado para o hotel']],
      ])
      expect(timeline[0].items[0]).toEqual({
        id: expect.any(Number),
        name: 'Técnica viaja para Manaus',
        when: { date: '2026-11-12', time: '08:00', timezone: 'America/Sao_Paulo' },
        place: { name: 'Aeroporto de Guarulhos', address: null, timezone: 'America/Sao_Paulo' },
        state: 'PUBLISHED',
      })
    })

    it('labels the items with no zone of their own with the Event zone, following an edit of the Event', async () => {
      await t
        .http()
        .patch(`/api/v1/events/${eventId}`)
        .auth(ownerToken, { type: 'bearer' })
        .send({
          period: { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Sao_Paulo' },
        })

      const res = await t.http().get(scheduleUrl()).auth(ownerToken, { type: 'bearer' })

      expect(res.body.data.timeline[1].items[1].when).toEqual({
        date: '2026-11-14',
        time: '15:00',
        timezone: 'America/Sao_Paulo',
      })
    })

    it('gives an empty schedule for an Event with no items', async () => {
      const res = await t.http().get(scheduleUrl(otherEventId)).auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { generalInfo: [], timeline: [] } })
    })

    it('answers 403 to a Viewer and 404 to who is not a Group member', async () => {
      expect((await t.http().get(scheduleUrl()).auth(viewerToken, { type: 'bearer' })).status).toBe(
        403,
      )
      expect(
        (await t.http().get(scheduleUrl()).auth(outsiderToken, { type: 'bearer' })).status,
      ).toBe(404)
    })
  })
})
