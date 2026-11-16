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
  const users = (...ids: number[]) => ids.map((userId) => ({ userId }))
  const createCar = (people: unknown, name = 'Carro 1 - EC') =>
    t.http().post(url()).auth(ownerToken, { type: 'bearer' }).send({ kind: 'PEOPLE', name, people })
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
    const res = await createCar(users(jacqueId, matiasId))

    expect(res.status).toBe(201)
    expect(res.body.data).toEqual({
      id: expect.any(Number),
      eventItemId: itemId,
      kind: 'PEOPLE',
      name: 'Carro 1 - EC',
      highlight: false,
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
    const res = await createCar(users(matiasId, strangerId))

    expect(res.status).toBe(409)
    expect(res.body).toEqual(errorOf('NOT_A_PARTICIPANT'))
    expect(await testPrisma().eventItemField.count()).toBe(0)
    expect(await fieldChanges()).toEqual([])
  })

  it('refuses a person twice, a text value and people in a text Field with 400', async () => {
    expect((await createCar(users(matiasId, matiasId))).status).toBe(400)
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
    expect((await editField(text.body.data.id, { people: users(matiasId) })).status).toBe(400)
  })

  it('lets a Viewer out of the Audience chosen see the item while in the Field, and not once taken out', async () => {
    expect(await itemsSeenBy(matiasToken)).toEqual([])

    const car = (await createCar(users(matiasId))).body.data.id as number

    const seen = await itemsSeenBy(matiasToken)
    expect(seen.map((i: { id: number }) => i.id)).toEqual([itemId])
    expect(seen[0].fields).toEqual([
      {
        id: car,
        kind: 'PEOPLE',
        name: 'Carro 1 - EC',
        highlight: false,
        value: [{ userId: matiasId, name: 'Matias' }],
      },
    ])

    expect((await editField(car, { people: users(jacqueId) })).status).toBe(200)

    expect(await itemsSeenBy(matiasToken)).toEqual([])
  })

  it('edits the people and their order, recording each as a Change with the reach before and after', async () => {
    const car = (await createCar(users(matiasId))).body.data.id as number

    const res = await editField(car, { people: users(jacqueId, matiasId) })
    expect(res.status).toBe(200)
    expect(res.body.data.value).toEqual([
      { userId: jacqueId, name: 'Jacque' },
      { userId: matiasId, name: 'Matias' },
    ])
    expect((await editField(car, { people: users(jacqueId) })).status).toBe(200)

    expect(await fieldChanges()).toEqual([
      expect.objectContaining({
        before: null,
        after: { fieldId: car, kind: 'PEOPLE', name: 'Carro 1 - EC', value: users(matiasId) },
        reachBefore: [ownerId],
        reachAfter: [ownerId, matiasId],
      }),
      expect.objectContaining({
        before: { fieldId: car, kind: 'PEOPLE', name: 'Carro 1 - EC', value: users(matiasId) },
        after: {
          fieldId: car,
          kind: 'PEOPLE',
          name: 'Carro 1 - EC',
          value: users(jacqueId, matiasId),
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
    const car = (await createCar(users(matiasId))).body.data.id as number

    const res = await editField(car, { people: users(strangerId) })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(errorOf('NOT_A_PARTICIPANT'))
    const people = await testPrisma().eventItemFieldPerson.findMany({ where: { fieldId: car } })
    expect(people.map((p) => p.userId)).toEqual([matiasId])
  })

  it('takes the people out with their Field', async () => {
    const car = (await createCar(users(matiasId))).body.data.id as number

    const res = await t.http().delete(`${url()}/${car}`).auth(ownerToken, { type: 'bearer' })

    expect(res.status).toBe(204)
    expect(await testPrisma().eventItemFieldPerson.count()).toBe(0)
    expect(await itemsSeenBy(matiasToken)).toEqual([])
  })

  describe('a loose name', () => {
    it('goes in among the Users, in one ordered list, read with the name only', async () => {
      const res = await createCar([{ userId: matiasId }, { name: ' Seu Raimundo ' }], 'Motorista')

      expect(res.status).toBe(201)
      expect(res.body.data.value).toEqual([
        { userId: matiasId, name: 'Matias' },
        { name: 'Seu Raimundo' },
      ])
      const seen = await itemsSeenBy(matiasToken)
      expect(seen[0].fields[0].value).toEqual([
        { userId: matiasId, name: 'Matias' },
        { name: 'Seu Raimundo' },
      ])
      const rows = await testPrisma().eventItemFieldPerson.findMany({
        where: { fieldId: res.body.data.id },
        orderBy: { position: 'asc' },
      })
      expect(rows).toMatchObject([
        { userId: matiasId, name: null, position: 1 },
        { userId: null, name: 'Seu Raimundo', position: 2, createdById: ownerId },
      ])
    })

    it('never becomes a User nor reaches anyone', async () => {
      const usersBefore = await testPrisma().user.count()

      const car = (await createCar([{ name: 'Seu Raimundo' }])).body.data.id as number

      expect(await testPrisma().user.count()).toBe(usersBefore)
      expect(await itemsSeenBy(matiasToken)).toEqual([])
      expect(await fieldChanges()).toEqual([
        expect.objectContaining({
          before: null,
          after: {
            fieldId: car,
            kind: 'PEOPLE',
            name: 'Carro 1 - EC',
            value: [{ name: 'Seu Raimundo' }],
          },
          reachBefore: [ownerId],
          reachAfter: [ownerId],
        }),
      ])
    })

    it('records putting, renaming and taking out a loose name as Changes, the reach as it was', async () => {
      const car = (await createCar(users(matiasId))).body.data.id as number

      const put = await editField(car, { people: [{ userId: matiasId }, { name: 'Raimundo' }] })
      expect(put.status).toBe(200)
      const renamed = await editField(car, {
        people: [{ name: 'Seu Raimundo' }, { userId: matiasId }],
      })
      expect(renamed.body.data.value).toEqual([
        { name: 'Seu Raimundo' },
        { userId: matiasId, name: 'Matias' },
      ])
      expect((await editField(car, { people: users(matiasId) })).status).toBe(200)

      const car1 = (value: unknown) => ({
        fieldId: car,
        kind: 'PEOPLE',
        name: 'Carro 1 - EC',
        value,
      })
      const [, ...edits] = await fieldChanges()
      expect(edits).toEqual([
        expect.objectContaining({
          before: car1(users(matiasId)),
          after: car1([{ userId: matiasId }, { name: 'Raimundo' }]),
          reachBefore: [ownerId, matiasId],
          reachAfter: [ownerId, matiasId],
        }),
        expect.objectContaining({
          before: car1([{ userId: matiasId }, { name: 'Raimundo' }]),
          after: car1([{ name: 'Seu Raimundo' }, { userId: matiasId }]),
          reachBefore: [ownerId, matiasId],
          reachAfter: [ownerId, matiasId],
        }),
        expect.objectContaining({
          before: car1([{ name: 'Seu Raimundo' }, { userId: matiasId }]),
          after: car1(users(matiasId)),
          reachBefore: [ownerId, matiasId],
          reachAfter: [ownerId, matiasId],
        }),
      ])
      const rows = await testPrisma().eventItemFieldPerson.findMany({ where: { fieldId: car } })
      expect(rows.map((p) => [p.userId, p.name, p.position])).toEqual([[matiasId, null, 1]])
    })

    it('refuses the same loose name twice, ignoring case, with 400, writing nothing', async () => {
      const res = await createCar([{ name: 'Raimundo' }, { name: 'raimundo' }])

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(await testPrisma().eventItemField.count()).toBe(0)
    })

    it('keeps a loose name once per Field in the database, ignoring case', async () => {
      const car = (await createCar([{ name: 'Raimundo' }])).body.data.id as number

      await expect(
        testPrisma().eventItemFieldPerson.create({
          data: { fieldId: car, name: 'raimundo', position: 2 },
        }),
      ).rejects.toThrow()
    })

    it('renames a loose name by its case alone, as a Change', async () => {
      const car = (await createCar([{ name: 'raimundo' }, { userId: matiasId }])).body.data
        .id as number

      const res = await editField(car, { people: [{ name: 'Raimundo' }, { userId: matiasId }] })

      expect(res.status).toBe(200)
      expect(res.body.data.value).toEqual([
        { name: 'Raimundo' },
        { userId: matiasId, name: 'Matias' },
      ])
      const rows = await testPrisma().eventItemFieldPerson.findMany({
        where: { fieldId: car },
        orderBy: { position: 'asc' },
      })
      expect(rows.map((p) => [p.userId, p.name, p.position])).toEqual([
        [null, 'Raimundo', 1],
        [matiasId, null, 2],
      ])
      const [, renamed] = await fieldChanges()
      expect(renamed).toEqual(
        expect.objectContaining({
          before: expect.objectContaining({ value: [{ name: 'raimundo' }, { userId: matiasId }] }),
          after: expect.objectContaining({ value: [{ name: 'Raimundo' }, { userId: matiasId }] }),
        }),
      )
    })

    it('refuses an empty loose name with 400, writing nothing', async () => {
      expect((await createCar([{ name: '   ' }])).status).toBe(400)
      expect((await createCar([{ name: '' }])).status).toBe(400)
      expect((await createCar([{ userId: matiasId, name: 'Matias' }])).status).toBe(400)
      expect(await testPrisma().eventItemField.count()).toBe(0)
    })
  })
})
