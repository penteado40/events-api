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

/**
 * The Highlight is the mark on a Field that takes it to the Summary: one card
 * per Event item with a Field in Highlight, showing only those Fields, first
 * the General info, then the Timeline (CONTEXT.md, Highlight, Summary).
 */
describe('Highlight and the Summary', () => {
  let t: TestApp
  let ownerId: number
  let viewerId: number
  let ownerToken: string
  let viewerToken: string
  let eventId: number

  beforeAll(async () => {
    t = await createTestApp()
  })

  beforeEach(async () => {
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    const groupId = (await createGroup({ name: 'Vocal Livre' })).id
    const owner = await createUser()
    const viewer = await createUser()
    ownerId = owner.id
    viewerId = viewer.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    ownerToken = sessionTokenFor(owner)
    viewerToken = sessionTokenFor(viewer)
    eventId = (await createEvent({ groupId, name: 'Shows em Manaus', endDate: '2026-11-16' })).id
    await createParticipant({ eventId, userId: owner.id })
    await createParticipant({ eventId, userId: viewer.id })
  })

  afterAll(() => t.close())

  const createItem = async (body: object): Promise<number> => {
    const res = await t
      .http()
      .post(`/api/v1/events/${eventId}/items`)
      .auth(ownerToken, { type: 'bearer' })
      .send(body)
    expect(res.status).toBe(201)
    return res.body.data.id as number
  }
  const fieldsUrl = (itemId: number) => `/api/v1/events/${eventId}/items/${itemId}/fields`
  const addField = async (itemId: number, name: string, value: string): Promise<number> => {
    const res = await t
      .http()
      .post(fieldsUrl(itemId))
      .auth(ownerToken, { type: 'bearer' })
      .send({ kind: 'TEXT', name, value })
    expect(res.status).toBe(201)
    return res.body.data.id as number
  }
  const editField = (itemId: number, fieldId: number, body: object, token = ownerToken) =>
    t
      .http()
      .patch(`${fieldsUrl(itemId)}/${fieldId}`)
      .auth(token, { type: 'bearer' })
      .send(body)
  const highlight = async (itemId: number, fieldId: number) => {
    expect((await editField(itemId, fieldId, { highlight: true })).status).toBe(200)
  }
  const summaryOf = async (token = ownerToken) => {
    const res = await t
      .http()
      .get(`/api/v1/events/${eventId}/schedule`)
      .auth(token, { type: 'bearer' })
    expect(res.status).toBe(200)
    return res.body.data.summary as { id: number; name: string; fields: { name: string }[] }[]
  }
  const cardsOf = (summary: Awaited<ReturnType<typeof summaryOf>>) =>
    summary.map((card) => [card.name, card.fields.map((f) => f.name)])
  const publishEvent = () =>
    t
      .http()
      .post(`/api/v1/events/${eventId}/publish`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)

  it('lets an Owner put a Field in Highlight, as its Author, and shows it on the Field', async () => {
    const itemId = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const place = await addField(itemId, 'Local', 'Teatro Amazonas')

    const res = await editField(itemId, place, { highlight: true })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ id: place, name: 'Local', highlight: true })
    const row = await testPrisma().eventItemField.findUniqueOrThrow({ where: { id: place } })
    expect(row).toMatchObject({ highlight: true, updatedById: ownerId })
  })

  it('records the Highlight as a Change only the production sees, apart from the public one', async () => {
    const itemId = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const place = await addField(itemId, 'Local', 'Teatro Amazonas')
    await publishEvent()

    expect((await editField(itemId, place, { name: 'Onde', highlight: true })).status).toBe(200)

    const changes = await testPrisma().change.findMany({
      where: { eventId, attribute: { in: ['field', 'fieldHighlight'] } },
      orderBy: { id: 'asc' },
    })
    expect(changes).toEqual([
      expect.objectContaining({ attribute: 'field', before: null }),
      expect.objectContaining({
        attribute: 'field',
        after: expect.objectContaining({ name: 'Onde' }),
        productionOnly: false,
      }),
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'fieldHighlight',
        before: { fieldId: place, highlight: false },
        after: { fieldId: place, highlight: true },
        productionOnly: true,
        reachBefore: [ownerId, viewerId],
        reachAfter: [ownerId, viewerId],
        createdById: ownerId,
      }),
    ])
  })

  it('answers 403 to a Viewer putting a Field in Highlight', async () => {
    const itemId = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const place = await addField(itemId, 'Local', 'Teatro Amazonas')

    expect((await editField(itemId, place, { highlight: true }, viewerToken)).status).toBe(403)
  })

  it('refuses a Highlight that is not a boolean with 400', async () => {
    const itemId = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const place = await addField(itemId, 'Local', 'Teatro Amazonas')

    expect((await editField(itemId, place, { highlight: 'yes' })).status).toBe(400)
  })

  it('shows one card per item with a Field in Highlight, only those Fields, General info first', async () => {
    const show = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const soundcheck = await createItem({ name: 'Passagem', date: '2026-11-14', time: '15:00' })
    const contacts = await createItem({ name: 'Contatos da produção' })
    const lunch = await createItem({ name: 'Almoço', date: '2026-11-13' })
    await highlight(show, await addField(show, 'Local', 'Teatro Amazonas'))
    await addField(show, 'Obs', 'chegar cedo')
    await addField(soundcheck, 'Local', 'Teatro Amazonas')
    await highlight(contacts, await addField(contacts, 'Produção', '(92) 99999-0000'))
    await highlight(lunch, await addField(lunch, 'Restaurante', 'Banzeiro'))

    expect(cardsOf(await summaryOf())).toEqual([
      ['Contatos da produção', ['Produção']],
      ['Almoço', ['Restaurante']],
      ['Show', ['Local']],
    ])
  })

  it('leaves out of the Summary of a Viewer an item that does not reach them', async () => {
    const show = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const van = await createItem({ name: 'Van 1', date: '2026-11-14', time: '10:00' })
    await highlight(show, await addField(show, 'Local', 'Teatro Amazonas'))
    await highlight(van, await addField(van, 'Motorista', 'Seu Raimundo'))
    const audience = await t
      .http()
      .patch(`/api/v1/events/${eventId}/items/${van}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ audience: { kind: 'SELECTED', userIds: [ownerId] } })
    expect(audience.status).toBe(200)
    await publishEvent()

    expect(cardsOf(await summaryOf(viewerToken))).toEqual([['Show', ['Local']]])
    expect(cardsOf(await summaryOf())).toEqual([
      ['Van 1', ['Motorista']],
      ['Show', ['Local']],
    ])
  })

  it('takes the card out when its last Field leaves the Highlight', async () => {
    const show = await createItem({ name: 'Show', date: '2026-11-14', time: '19:00' })
    const place = await addField(show, 'Local', 'Teatro Amazonas')
    await highlight(show, place)

    expect((await editField(show, place, { highlight: false })).status).toBe(200)

    expect(await summaryOf()).toEqual([])
  })

  it('brings the Summary in the schedule the new order of the items answers', async () => {
    const first = await createItem({ name: 'O que levar' })
    const second = await createItem({ name: 'Contatos da produção' })
    await highlight(first, await addField(first, 'Roupa', 'preto'))
    await highlight(second, await addField(second, 'Produção', '(92) 99999-0000'))

    const res = await t
      .http()
      .put(`/api/v1/events/${eventId}/items/order`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ itemIds: [second, first] })

    expect(res.status).toBe(200)
    expect(cardsOf(res.body.data.summary)).toEqual([
      ['Contatos da produção', ['Produção']],
      ['O que levar', ['Roupa']],
    ])
  })
})
