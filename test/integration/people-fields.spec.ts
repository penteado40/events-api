import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import {
  createEvent,
  createGroup,
  createGroupMember,
  createParticipant,
  createUser,
  sessionTokenFor,
} from './support/factories.js'

function errorOf(code: string) {
  return { error: { code, message: expect.any(String) } }
}

/**
 * A people Field ("Carro 1 - EC: Matias, Jacque") holds Participants, in
 * order; whoever is in it is in the item's Audience while there, even out of
 * the Audience chosen (CONTEXT.md, Field and Audience).
 */
describe('People Fields of an Event item', () => {
  let t: TestApp
  let ownerId: number
  let ownerToken: string
  let matiasId: number
  let matiasToken: string
  let jacqueId: number
  let strangerId: number
  let eventId: number
  let itemId: number

  beforeAll(async () => {
    t = await createTestApp()
  })

  beforeEach(async () => {
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    const groupId = (await createGroup({ name: 'Vocal Livre' })).id
    const owner = await createUser({ name: 'Ana' })
    const matias = await createUser({ name: 'Matias' })
    const jacque = await createUser({ name: 'Jacque' })
    // A Viewer of the Group who does not go to the Event.
    const stranger = await createUser({ name: 'Bruno' })
    ownerId = owner.id
    matiasId = matias.id
    jacqueId = jacque.id
    strangerId = stranger.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    for (const viewer of [matias, jacque, stranger]) {
      await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    }
    ownerToken = sessionTokenFor(owner)
    matiasToken = sessionTokenFor(matias)
    eventId = (await createEvent({ groupId, name: 'Shows em Manaus', endDate: '2026-11-16' })).id
    await createParticipant({ eventId, userId: matias.id })
    await createParticipant({ eventId, userId: jacque.id })
    const item = await t
      .http()
      .post(`/api/v1/events/${eventId}/items`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ name: 'Saída terrestre', date: '2026-11-14', time: '15:00' })
    expect(item.status).toBe(201)
    itemId = item.body.data.id
    // Only for whom the production chooses: no one, so far.
    const audience = await t
      .http()
      .patch(`/api/v1/events/${eventId}/items/${itemId}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ audience: { kind: 'SELECTED', userIds: [] } })
    expect(audience.status).toBe(200)
    await t
      .http()
      .post(`/api/v1/events/${eventId}/publish`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)
  })

  afterAll(() => t.close())

  const fieldsUrl = `/api/v1/events/:event/items/:item/fields`
  const url = () => fieldsUrl.replace(':event', String(eventId)).replace(':item', String(itemId))
  const createCar = (userIds: unknown, name = 'Carro 1 - EC') =>
    t
      .http()
      .post(url())
      .auth(ownerToken, { type: 'bearer' })
      .send({ kind: 'PEOPLE', name, userIds })
  const editField = (fieldId: number, body: object) =>
    t.http().patch(`${url()}/${fieldId}`).auth(ownerToken, { type: 'bearer' }).send(body)
  const itemsSeenBy = async (token: string) => {
    const res = await t
      .http()
      .get(`/api/v1/events/${eventId}/schedule`)
      .auth(token, { type: 'bearer' })
    expect(res.status).toBe(200)
    return res.body.data.timeline.flatMap(
      (day: { items: { id: number; fields: unknown[] }[] }) => day.items,
    )
  }
  const fieldChanges = () =>
    testPrisma().change.findMany({
      where: { eventId, attribute: 'field' },
      orderBy: { id: 'asc' },
    })

  it('lets an Owner add a people Field, answering the people by name, in the order given', async () => {
    const res = await createCar([jacqueId, matiasId])

    expect(res.status).toBe(201)
    expect(res.body.data).toEqual({
      id: expect.any(Number),
      eventItemId: itemId,
      kind: 'PEOPLE',
      name: 'Carro 1 - EC',
      value: [
        { userId: jacqueId, name: 'Jacque' },
        { userId: matiasId, name: 'Matias' },
      ],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    const people = await testPrisma().eventItemFieldPerson.findMany({
      where: { fieldId: res.body.data.id },
      orderBy: { position: 'asc' },
    })
    expect(people).toMatchObject([
      { userId: jacqueId, position: 1, createdById: ownerId },
      { userId: matiasId, position: 2, createdById: ownerId },
    ])
  })

  it('refuses who is not a Participant with 409 NOT_A_PARTICIPANT, writing nothing', async () => {
    const res = await createCar([matiasId, strangerId])

    expect(res.status).toBe(409)
    expect(res.body).toEqual(errorOf('NOT_A_PARTICIPANT'))
    expect(await testPrisma().eventItemField.count()).toBe(0)
    expect(await fieldChanges()).toEqual([])
  })

  it('refuses a person twice, a text value and people in a text Field with 400', async () => {
    expect((await createCar([matiasId, matiasId])).status).toBe(400)
    const mixed = await t
      .http()
      .post(url())
      .auth(ownerToken, { type: 'bearer' })
      .send({ kind: 'PEOPLE', name: 'Carro', value: 'Matias' })
    expect(mixed.status).toBe(400)
    const text = await t
      .http()
      .post(url())
      .auth(ownerToken, { type: 'bearer' })
      .send({ kind: 'TEXT', name: 'Obs', value: '' })
    expect((await editField(text.body.data.id, { userIds: [matiasId] })).status).toBe(400)
  })

  it('lets a Viewer out of the Audience chosen see the item while in the Field, and not once taken out', async () => {
    expect(await itemsSeenBy(matiasToken)).toEqual([])

    const car = (await createCar([matiasId])).body.data.id as number

    const seen = await itemsSeenBy(matiasToken)
    expect(seen.map((i: { id: number }) => i.id)).toEqual([itemId])
    expect(seen[0].fields).toEqual([
      {
        id: car,
        kind: 'PEOPLE',
        name: 'Carro 1 - EC',
        value: [{ userId: matiasId, name: 'Matias' }],
      },
    ])

    expect((await editField(car, { userIds: [jacqueId] })).status).toBe(200)

    expect(await itemsSeenBy(matiasToken)).toEqual([])
  })

  it('edits the people and their order, recording each as a Change with the reach before and after', async () => {
    const car = (await createCar([matiasId])).body.data.id as number

    const res = await editField(car, { userIds: [jacqueId, matiasId] })
    expect(res.status).toBe(200)
    expect(res.body.data.value).toEqual([
      { userId: jacqueId, name: 'Jacque' },
      { userId: matiasId, name: 'Matias' },
    ])
    expect((await editField(car, { userIds: [jacqueId] })).status).toBe(200)

    expect(await fieldChanges()).toEqual([
      expect.objectContaining({
        before: null,
        after: { fieldId: car, kind: 'PEOPLE', name: 'Carro 1 - EC', value: [matiasId] },
        reachBefore: [ownerId],
        reachAfter: [ownerId, matiasId],
      }),
      expect.objectContaining({
        before: { fieldId: car, kind: 'PEOPLE', name: 'Carro 1 - EC', value: [matiasId] },
        after: {
          fieldId: car,
          kind: 'PEOPLE',
          name: 'Carro 1 - EC',
          value: [jacqueId, matiasId],
        },
        reachBefore: [ownerId, matiasId],
        reachAfter: [ownerId, matiasId, jacqueId],
        createdById: ownerId,
      }),
      expect.objectContaining({
        reachBefore: [ownerId, matiasId, jacqueId],
        reachAfter: [ownerId, jacqueId],
      }),
    ])
    const people = await testPrisma().eventItemFieldPerson.findMany({ where: { fieldId: car } })
    expect(people.map((p) => p.userId)).toEqual([jacqueId])
  })

  it('refuses editing in who is not a Participant with 409 NOT_A_PARTICIPANT, keeping the Field', async () => {
    const car = (await createCar([matiasId])).body.data.id as number

    const res = await editField(car, { userIds: [strangerId] })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(errorOf('NOT_A_PARTICIPANT'))
    const people = await testPrisma().eventItemFieldPerson.findMany({ where: { fieldId: car } })
    expect(people.map((p) => p.userId)).toEqual([matiasId])
  })

  it('takes the people out with their Field', async () => {
    const car = (await createCar([matiasId])).body.data.id as number

    const res = await t.http().delete(`${url()}/${car}`).auth(ownerToken, { type: 'bearer' })

    expect(res.status).toBe(204)
    expect(await testPrisma().eventItemFieldPerson.count()).toBe(0)
    expect(await itemsSeenBy(matiasToken)).toEqual([])
  })
})
