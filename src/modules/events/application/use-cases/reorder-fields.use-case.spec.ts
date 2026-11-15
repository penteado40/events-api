import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { ANA, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { arrangeFieldWrites } from '../testing/field-writes-fixture.js'
import { ReorderFieldsUseCase } from './reorder-fields.use-case.js'

const NOW = new Date('2026-11-01T12:00:00.000Z')
const BRUNO_ID = 3

describe('ReorderFieldsUseCase', () => {
  let arranged: Awaited<ReturnType<typeof arrangeFieldWrites>>
  let reorderFields: ReorderFieldsUseCase
  let flight: number
  let notes: number
  let contact: number

  beforeEach(async () => {
    arranged = await arrangeFieldWrites(NOW)
    reorderFields = new ReorderFieldsUseCase(arranged.deps)
    flight = await arranged.addField('Voo', 'G3 1234')
    notes = await arranged.addField('Obs', 'despachar som')
    contact = await arranged.addField('Contato', '(92) 99999-0000')
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER').addMember(1, BRUNO_ID, 'VIEWER')
    await arranged.deps.participants.create(arranged.eventId, [BRUNO_ID], { by: null, at: NOW })
  })

  const reorder = (fieldIds: number[], actor = ANA) =>
    reorderFields.execute({ actor, eventId: arranged.eventId, itemId: arranged.itemId, fieldIds })

  const names = () => arranged.deps.fields.ofItem(arranged.itemId).map((f) => f.name)

  it('lets an Owner put the Fields of an item in a new order, and answers them in it', async () => {
    const fields = await reorder([contact, flight, notes])

    expect(fields.map((f) => f.name)).toEqual(['Contato', 'Voo', 'Obs'])
    expect(names()).toEqual(['Contato', 'Voo', 'Obs'])
  })

  it('records the new order as one Change of the item that only the production sees', async () => {
    await reorder([contact, flight, notes])

    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
      expect.objectContaining({
        eventItemId: arranged.itemId,
        attribute: 'fieldOrder',
        before: [flight, notes, contact],
        after: [contact, flight, notes],
        productionOnly: true,
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('has who reordered as the Author of each Field that moved', async () => {
    await reorder([flight, contact, notes])

    const [kept, ...moved] = arranged.deps.fields.ofItem(arranged.itemId)
    expect(kept?.updatedById).toBeNull()
    expect(moved.map((f) => f.updatedById)).toEqual([ANA.id, ANA.id])
  })

  it('writes nothing for the same order', async () => {
    await reorder([flight, notes, contact])

    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
  })

  it('refuses an order that leaves a Field out with FIELD_ORDER_INCOMPLETE', async () => {
    await expect(reorder([contact, flight])).rejects.toEqual(new AppError('FIELD_ORDER_INCOMPLETE'))
    expect(names()).toEqual(['Voo', 'Obs', 'Contato'])
  })

  it('refuses a Field given twice with VALIDATION_ERROR, and one not of the item with NOT_FOUND', async () => {
    await expect(reorder([contact, contact, flight])).rejects.toEqual(
      new AppError('VALIDATION_ERROR'),
    )
    await expect(reorder([contact, flight, 42])).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('forbids a Viewer', async () => {
    await expect(
      reorder([contact, flight, notes], { id: BRUNO_ID, isSuperAdmin: false }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('refuses reordering the Fields of a Cancelled Event or item with a 409, keeping the order', async () => {
    await arranged.cancelItem()
    await expect(reorder([contact, flight, notes], SUPER_ADMIN)).rejects.toEqual(
      new AppError('EVENT_ITEM_CANCELLED'),
    )
    await arranged.cancelEvent()
    await expect(reorder([contact, flight, notes], SUPER_ADMIN)).rejects.toEqual(
      new AppError('EVENT_CANCELLED'),
    )
    expect(names()).toEqual(['Voo', 'Obs', 'Contato'])
  })
})
