import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { ANA, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { arrangeFieldWrites } from '../testing/field-writes-fixture.js'
import { DeleteFieldUseCase } from './delete-field.use-case.js'

const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('DeleteFieldUseCase', () => {
  let arranged: Awaited<ReturnType<typeof arrangeFieldWrites>>
  let deleteField: DeleteFieldUseCase
  let fieldId: number

  beforeEach(async () => {
    arranged = await arrangeFieldWrites(NOW)
    deleteField = new DeleteFieldUseCase(arranged.deps)
    fieldId = await arranged.addField('Obs', 'despachar som')
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER')
  })

  const remove = (actor = ANA, id = fieldId) =>
    deleteField.execute({ actor, eventId: arranged.eventId, itemId: arranged.itemId, fieldId: id })

  it('lets an Owner delete a Field, recording what it was as a Change of the item', async () => {
    await remove()

    expect(arranged.deps.fields.ofItem(arranged.itemId)).toEqual([])
    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
      expect.objectContaining({
        eventItemId: arranged.itemId,
        attribute: 'field',
        before: { fieldId, kind: 'TEXT', name: 'Obs', value: 'despachar som' },
        after: null,
        productionOnly: false,
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('answers NOT_FOUND for a Field that is not of the item', async () => {
    await expect(remove(ANA, 42)).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('forbids a Viewer, keeping the Field', async () => {
    arranged.deps.directory.addMember(1, 3, 'VIEWER')

    await expect(remove({ id: 3, isSuperAdmin: false })).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(arranged.deps.fields.ofItem(arranged.itemId)).toHaveLength(1)
  })

  it('refuses deleting a Field of a Cancelled Event with EVENT_CANCELLED', async () => {
    await arranged.cancelEvent()

    await expect(remove(SUPER_ADMIN)).rejects.toEqual(new AppError('EVENT_CANCELLED'))
    expect(arranged.deps.fields.ofItem(arranged.itemId)).toHaveLength(1)
  })

  it('refuses deleting a Field of a Cancelled item with EVENT_ITEM_CANCELLED', async () => {
    await arranged.cancelItem()

    await expect(remove(SUPER_ADMIN)).rejects.toEqual(new AppError('EVENT_ITEM_CANCELLED'))
    expect(arranged.deps.fields.ofItem(arranged.itemId)).toHaveLength(1)
  })

  it('records the removal of a people Field with a reach after that leaves out who was only there', async () => {
    await arranged.addParticipants(4)
    await arranged.chooseAudience()
    const carId = await arranged.addPeopleField('Carro 1 - EC', [4])

    await remove(ANA, carId)

    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
      expect.objectContaining({
        before: { fieldId: carId, kind: 'PEOPLE', name: 'Carro 1 - EC', value: [{ userId: 4 }] },
        after: null,
        reachBefore: [ANA.id, 4],
        reachAfter: [ANA.id],
      }),
    ])
  })
})
