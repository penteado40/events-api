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
 * A Field is a free piece of information inside an Event item, with a name
 * and a value of one type only (CONTEXT.md, Field); for now, text.
 */
describe('Fields of an Event item', () => {
  let t: TestApp
  let ownerId: number
  let ownerToken: string
  let viewerToken: string
  let outsiderToken: string
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
    eventId = (await createEvent({ groupId, name: 'Shows em Manaus', endDate: '2026-11-16' })).id
    await createParticipant({ eventId, userId: viewer.id })
    const item = await t
      .http()
      .post(`/api/v1/events/${eventId}/items`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ name: 'Passagem de som', date: '2026-11-14', time: '15:00' })
    expect(item.status).toBe(201)
    itemId = item.body.data.id
  })

  afterAll(() => t.close())

  const fieldsUrl = (item = itemId, event = eventId) =>
    `/api/v1/events/${event}/items/${item}/fields`
  const createField = (body: object, token = ownerToken) =>
    t.http().post(fieldsUrl()).auth(token, { type: 'bearer' }).send(body)
  const addField = async (name: string, value: string): Promise<number> => {
    const res = await createField({ kind: 'TEXT', name, value })
    expect(res.status).toBe(201)
    return res.body.data.id as number
  }
  const editField = (fieldId: number, body: object, token = ownerToken) =>
    t.http().patch(`${fieldsUrl()}/${fieldId}`).auth(token, { type: 'bearer' }).send(body)
  const deleteField = (fieldId: number, token = ownerToken) =>
    t.http().delete(`${fieldsUrl()}/${fieldId}`).auth(token, { type: 'bearer' })
  const reorder = (fieldIds: unknown, token = ownerToken) =>
    t.http().put(`${fieldsUrl()}/order`).auth(token, { type: 'bearer' }).send({ fieldIds })
  const fieldsInSchedule = async (token = ownerToken) => {
    const res = await t
      .http()
      .get(`/api/v1/events/${eventId}/schedule`)
      .auth(token, { type: 'bearer' })
    expect(res.status).toBe(200)
    return res.body.data.timeline.flatMap((day: { items: { fields: unknown[] }[] }) =>
      day.items.map((i) => i.fields),
    )
  }
  const changeRows = () =>
    testPrisma().change.findMany({
      where: { eventId, attribute: { in: ['field', 'fieldOrder'] } },
      orderBy: { id: 'asc' },
    })
  const publishEvent = () =>
    t
      .http()
      .post(`/api/v1/events/${eventId}/publish`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)

  it('lets an Owner add a text Field, as its Author, with the type kept in its row', async () => {
    const res = await createField({ kind: 'TEXT', name: 'Obs', value: 'despachar som' })

    expect(res.status).toBe(201)
    expect(res.body.data).toEqual({
      id: expect.any(Number),
      eventItemId: itemId,
      kind: 'TEXT',
      name: 'Obs',
      value: 'despachar som',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    const row = await testPrisma().eventItemField.findUniqueOrThrow({
      where: { id: res.body.data.id },
    })
    expect(row).toMatchObject({ kind: 'TEXT', textValue: 'despachar som', createdById: ownerId })
  })

  it('refuses a type that does not exist and a blank name with 400', async () => {
    expect((await createField({ kind: 'PHOTOS', name: 'Roupa', value: '' })).status).toBe(400)
    expect((await createField({ kind: 'TEXT', name: ' ', value: '' })).status).toBe(400)
  })

  it('brings the Fields of each item, in the order, to the Owner and to the Viewer it reaches', async () => {
    const flight = await addField('Voo', 'G3 1234')
    const notes = await addField('Obs', 'despachar som')
    await publishEvent()

    const expected = [
      [
        { id: flight, kind: 'TEXT', name: 'Voo', value: 'G3 1234' },
        { id: notes, kind: 'TEXT', name: 'Obs', value: 'despachar som' },
      ],
    ]
    expect(await fieldsInSchedule()).toEqual(expected)
    expect(await fieldsInSchedule(viewerToken)).toEqual(expected)
  })

  it('records editing the value as a Change of the item, with before and after', async () => {
    const flight = await addField('Voo', 'G3 1234')

    const res = await editField(flight, { value: 'G3 1250' })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ name: 'Voo', value: 'G3 1250' })
    expect(await changeRows()).toEqual([
      expect.objectContaining({ before: null, productionOnly: false }),
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'field',
        before: { fieldId: flight, kind: 'TEXT', name: 'Voo', value: 'G3 1234' },
        after: { fieldId: flight, kind: 'TEXT', name: 'Voo', value: 'G3 1250' },
        productionOnly: false,
        createdById: ownerId,
      }),
    ])
  })

  it('deletes a Field, recording what it was', async () => {
    const notes = await addField('Obs', 'despachar som')

    expect((await deleteField(notes)).status).toBe(204)

    expect(await fieldsInSchedule()).toEqual([[]])
    expect((await changeRows()).at(-1)).toMatchObject({
      attribute: 'field',
      before: { fieldId: notes, name: 'Obs' },
      after: null,
    })
  })

  it('reorders the Fields, with a Change only the production sees', async () => {
    const flight = await addField('Voo', 'G3 1234')
    const notes = await addField('Obs', 'despachar som')
    const contact = await addField('Contato', '(92) 99999-0000')

    const res = await reorder([contact, flight, notes])

    expect(res.status).toBe(200)
    expect(res.body.data.map((f: { name: string }) => f.name)).toEqual(['Contato', 'Voo', 'Obs'])
    expect((await fieldsInSchedule())[0].map((f: { name: string }) => f.name)).toEqual([
      'Contato',
      'Voo',
      'Obs',
    ])
    expect((await changeRows()).at(-1)).toMatchObject({
      eventItemId: itemId,
      attribute: 'fieldOrder',
      before: [flight, notes, contact],
      after: [contact, flight, notes],
      productionOnly: true,
    })
  })

  it('refuses an order that leaves a Field out with 409 FIELD_ORDER_INCOMPLETE, and a repeated one with 400', async () => {
    const flight = await addField('Voo', 'G3 1234')
    const notes = await addField('Obs', 'despachar som')

    const incomplete = await reorder([notes])
    expect(incomplete.status).toBe(409)
    expect(incomplete.body).toEqual(errorOf('FIELD_ORDER_INCOMPLETE'))
    expect((await reorder([flight, flight])).status).toBe(400)
  })

  it('answers 404 for a Field of another item and for an item of another Event', async () => {
    const flight = await addField('Voo', 'G3 1234')
    const other = await t
      .http()
      .post(`/api/v1/events/${eventId}/items`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ name: 'O que levar' })
    const otherEventId = (
      await createEvent({
        groupId: (await testPrisma().event.findUniqueOrThrow({ where: { id: eventId } })).groupId,
      })
    ).id

    const res = await t
      .http()
      .patch(`${fieldsUrl(other.body.data.id)}/${flight}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ value: 'x' })
    expect(res.status).toBe(404)
    const elsewhere = await t
      .http()
      .post(fieldsUrl(itemId, otherEventId))
      .auth(ownerToken, { type: 'bearer' })
      .send({ kind: 'TEXT', name: 'Obs', value: '' })
    expect(elsewhere.status).toBe(404)
  })

  it('forbids a Viewer with 403, answers 404 to who is not a Group member and 401 with no token', async () => {
    const flight = await addField('Voo', 'G3 1234')

    expect((await createField({ kind: 'TEXT', name: 'Obs', value: '' }, viewerToken)).status).toBe(
      403,
    )
    expect((await editField(flight, { value: 'x' }, viewerToken)).status).toBe(403)
    expect((await deleteField(flight, viewerToken)).status).toBe(403)
    expect((await reorder([flight], viewerToken)).status).toBe(403)
    expect((await editField(flight, { value: 'x' }, outsiderToken)).status).toBe(404)
    expect(
      (await t.http().post(fieldsUrl()).send({ kind: 'TEXT', name: 'Obs', value: '' })).status,
    ).toBe(401)
  })

  it('freezes the Fields of a Cancelled item with 409 EVENT_ITEM_CANCELLED', async () => {
    const flight = await addField('Voo', 'G3 1234')
    await publishEvent()
    await t
      .http()
      .post(`/api/v1/events/${eventId}/items/${itemId}/cancel`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)

    for (const res of [
      await createField({ kind: 'TEXT', name: 'Obs', value: '' }),
      await editField(flight, { value: 'x' }),
      await deleteField(flight),
      await reorder([flight]),
    ]) {
      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('EVENT_ITEM_CANCELLED'))
    }
  })

  it('freezes the Fields of an item of a Cancelled Event with 409 EVENT_CANCELLED', async () => {
    const flight = await addField('Voo', 'G3 1234')
    await t
      .http()
      .post(`/api/v1/events/${eventId}/cancel`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)

    for (const res of [
      await createField({ kind: 'TEXT', name: 'Obs', value: '' }),
      await editField(flight, { value: 'x' }),
      await deleteField(flight),
      await reorder([flight]),
    ]) {
      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('EVENT_CANCELLED'))
    }
    expect(
      (await testPrisma().eventItemField.findMany({ where: { eventItemId: itemId } })).map(
        (f) => f.textValue,
      ),
    ).toEqual(['G3 1234'])
  })
})
