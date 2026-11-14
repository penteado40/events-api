import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

/**
 * Where the time does not decide (the General info, a day with no time, the
 * same time), the order of the production applies, and an Owner changes it
 * (CONTEXT.md, Event item). It never passes over the time.
 */
describe('PUT /api/v1/events/:id/items/order', () => {
  let t: TestApp
  let ownerId: number
  let viewerId: number
  let ownerToken: string
  let viewerToken: string
  let outsiderToken: string
  let eventId: number
  let otherEventId: number

  beforeAll(async () => {
    t = await createTestApp()
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
    viewerId = viewer.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    await createGroupMember({ groupId: otherGroupId, userId: outsider.id, role: 'OWNER' })
    ownerToken = sessionTokenFor(owner)
    viewerToken = sessionTokenFor(viewer)
    outsiderToken = sessionTokenFor(outsider)
    const period = { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' }
    eventId = (await createEvent({ groupId, name: 'Shows em Manaus', ...period })).id
    otherEventId = (await createEvent({ groupId, name: 'Ensaio', ...period })).id
  })

  afterAll(() => t.close())

  const createItem = async (body: object, id = eventId): Promise<number> => {
    const res = await t
      .http()
      .post(`/api/v1/events/${id}/items`)
      .auth(ownerToken, { type: 'bearer' })
      .send(body)
    expect(res.status).toBe(201)
    return res.body.data.id as number
  }
  const reorder = (itemIds: unknown, token = ownerToken) =>
    t
      .http()
      .put(`/api/v1/events/${eventId}/items/order`)
      .auth(token, { type: 'bearer' })
      .send({ itemIds })
  const schedule = async () => {
    const res = await t
      .http()
      .get(`/api/v1/events/${eventId}/schedule`)
      .auth(ownerToken, { type: 'bearer' })
    expect(res.status).toBe(200)
    return res.body.data as {
      generalInfo: { name: string }[]
      timeline: { date: string; items: { name: string }[] }[]
    }
  }
  const changeRows = () =>
    testPrisma().change.findMany({ where: { eventId }, orderBy: { id: 'asc' } })

  it('puts the General info in the new order', async () => {
    const whatToBring = await createItem({ name: 'O que levar' })
    const contacts = await createItem({ name: 'Contatos da produção' })
    const voltage = await createItem({ name: 'Voltagem' })

    const res = await reorder([voltage, whatToBring, contacts])

    expect(res.status).toBe(200)
    expect((await schedule()).generalInfo.map((i) => i.name)).toEqual([
      'Voltagem',
      'O que levar',
      'Contatos da produção',
    ])
  })

  it('puts the items of a day with no time, and two at the same time, in the new order, never over the time', async () => {
    const lunch = await createItem({ name: 'Almoço', date: '2026-11-14' })
    await createItem({ name: 'Café da manhã', date: '2026-11-14', time: '09:00' })
    const van1 = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })
    const van2 = await createItem({ name: 'Van 2', date: '2026-11-14', time: '10:00' })
    const dayOff = await createItem({ name: 'Folga da Banda', date: '2026-11-14' })

    expect((await reorder([dayOff, lunch])).status).toBe(200)
    expect((await reorder([van2, van1])).status).toBe(200)

    expect((await schedule()).timeline).toEqual([
      {
        date: '2026-11-14',
        items: [
          expect.objectContaining({ name: 'Folga da Banda' }),
          expect.objectContaining({ name: 'Almoço' }),
          expect.objectContaining({ name: 'Café da manhã' }),
          expect.objectContaining({ name: 'Van 2' }),
          expect.objectContaining({ name: 'Van 1' }),
        ],
      },
    ])
  })

  it('puts a new item last in its group, after the new order', async () => {
    const whatToBring = await createItem({ name: 'O que levar' })
    const contacts = await createItem({ name: 'Contatos da produção' })
    await reorder([contacts, whatToBring])

    await createItem({ name: 'Voltagem' })

    expect((await schedule()).generalInfo.map((i) => i.name)).toEqual([
      'Contatos da produção',
      'O que levar',
      'Voltagem',
    ])
  })

  it('writes one Change of the Event that only the production sees, with its Author', async () => {
    const van1 = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })
    const van2 = await createItem({ name: 'Van 2', date: '2026-11-14', time: '10:00' })

    await reorder([van2, van1])

    expect((await changeRows()).slice(2)).toEqual([
      expect.objectContaining({
        eventItemId: null,
        attribute: 'itemOrder',
        before: [van1, van2],
        after: [van2, van1],
        productionOnly: true,
        reachBefore: expect.arrayContaining([ownerId, viewerId]),
        reachAfter: expect.arrayContaining([ownerId, viewerId]),
        createdById: ownerId,
      }),
    ])
  })

  it('makes who reordered the Author of each item that moved, and only of those', async () => {
    const reorderer = await createUser()
    const groupId = (await testPrisma().event.findUniqueOrThrow({ where: { id: eventId } })).groupId
    await createGroupMember({ groupId, userId: reorderer.id, role: 'OWNER' })
    const van1 = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })
    const van2 = await createItem({ name: 'Van 2', date: '2026-11-14', time: '10:00' })
    const lunch = await createItem({ name: 'Almoço', date: '2026-11-14' })

    await reorder([van2, van1], sessionTokenFor(reorderer))

    const authors = await testPrisma().eventItem.findMany({
      where: { id: { in: [van1, van2, lunch] } },
      select: { id: true, updatedById: true },
      orderBy: { id: 'asc' },
    })
    expect(authors).toEqual([
      { id: van1, updatedById: reorderer.id },
      { id: van2, updatedById: reorderer.id },
      { id: lunch, updatedById: ownerId },
    ])
  })

  it('writes nothing when the order is the same', async () => {
    const van1 = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })
    const van2 = await createItem({ name: 'Van 2', date: '2026-11-14', time: '10:00' })

    expect((await reorder([van1, van2])).status).toBe(200)

    expect((await changeRows()).map((c) => c.attribute)).toEqual(['item', 'item'])
  })

  it('answers 400 EVENT_ITEM_ORDER_MIXED for items where the time decides', async () => {
    const coffee = await createItem({ name: 'Café da manhã', date: '2026-11-14', time: '09:00' })
    const soundcheck = await createItem({
      name: 'Passagem de som',
      date: '2026-11-14',
      time: '10:00',
    })

    const res = await reorder([soundcheck, coffee])

    expect(res.status).toBe(400)
    expect(res.body).toEqual(errorOf('EVENT_ITEM_ORDER_MIXED'))
  })

  it('answers 409 EVENT_ITEM_ORDER_INCOMPLETE for a group left incomplete', async () => {
    const van1 = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })
    const van2 = await createItem({ name: 'Van 2', date: '2026-11-14', time: '10:00' })
    await createItem({ name: 'Van 3', date: '2026-11-14', time: '10:00' })

    const res = await reorder([van2, van1])

    expect(res.status).toBe(409)
    expect(res.body).toEqual(errorOf('EVENT_ITEM_ORDER_INCOMPLETE'))
  })

  it('answers 400 for an item given twice or an empty order', async () => {
    const van1 = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })

    expect((await reorder([van1, van1])).body.error.code).toBe('VALIDATION_ERROR')
    expect((await reorder([])).body.error.code).toBe('VALIDATION_ERROR')
  })

  it('answers 409 EVENT_CANCELLED in a Cancelled Event', async () => {
    const whatToBring = await createItem({ name: 'O que levar' })
    const contacts = await createItem({ name: 'Contatos da produção' })
    const cancel = await t
      .http()
      .post(`/api/v1/events/${eventId}/cancel`)
      .auth(ownerToken, { type: 'bearer' })
    expect(cancel.status).toBe(200)

    const res = await reorder([contacts, whatToBring])

    expect(res.status).toBe(409)
    expect(res.body).toEqual(errorOf('EVENT_CANCELLED'))
  })

  it('answers 404 for an item of another Event, 403 to a Viewer, 404 to who is not a Group member', async () => {
    const whatToBring = await createItem({ name: 'O que levar' })
    const elsewhere = await createItem({ name: 'Contatos' }, otherEventId)

    expect((await reorder([elsewhere, whatToBring])).status).toBe(404)
    expect((await reorder([whatToBring], viewerToken)).status).toBe(403)
    expect((await reorder([whatToBring], outsiderToken)).status).toBe(404)
  })

  it('answers 401 with no token', async () => {
    const res = await t
      .http()
      .put(`/api/v1/events/${eventId}/items/order`)
      .send({ itemIds: [1] })

    expect(res.status).toBe(401)
  })
})
