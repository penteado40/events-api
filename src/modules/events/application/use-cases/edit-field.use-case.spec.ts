import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { ANA, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { arrangeFieldWrites } from '../testing/field-writes-fixture.js'
import { EditFieldUseCase } from './edit-field.use-case.js'

const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('EditFieldUseCase', () => {
  let arranged: Awaited<ReturnType<typeof arrangeFieldWrites>>
  let editField: EditFieldUseCase
  let fieldId: number

  beforeEach(async () => {
    arranged = await arrangeFieldWrites(NOW)
    editField = new EditFieldUseCase(arranged.deps)
    fieldId = await arranged.addField('Voo', 'G3 1234')
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER')
  })

  const edit = (change: { name?: string; value?: string }, actor = ANA, id = fieldId) =>
    editField.execute({
      actor,
      eventId: arranged.eventId,
      itemId: arranged.itemId,
      fieldId: id,
      ...change,
    })

  it('lets an Owner change the value, as its Author, keeping the name', async () => {
    const field = await edit({ value: 'G3 1250' })

    expect(field.snapshot()).toMatchObject({
      name: 'Voo',
      value: { kind: 'TEXT', text: 'G3 1250' },
    })
    expect(field).toMatchObject({ updatedById: ANA.id, updatedAt: NOW })
  })

  it('records the new value as a Change of the item, with before and after', async () => {
    await edit({ value: 'G3 1250' })

    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
      expect.objectContaining({
        eventItemId: arranged.itemId,
        attribute: 'field',
        before: { fieldId, kind: 'TEXT', name: 'Voo', value: 'G3 1234' },
        after: { fieldId, kind: 'TEXT', name: 'Voo', value: 'G3 1250' },
        productionOnly: false,
        reachBefore: [ANA.id],
        reachAfter: [ANA.id],
        by: ANA.id,
      }),
    ])
  })

  it('records a new name and value together as one Change', async () => {
    await edit({ name: 'Voo de ida', value: 'G3 1250' })

    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
      expect.objectContaining({
        before: expect.objectContaining({ name: 'Voo', value: 'G3 1234' }),
        after: expect.objectContaining({ name: 'Voo de ida', value: 'G3 1250' }),
      }),
    ])
  })

  it('writes nothing and keeps the last Author when nothing changed', async () => {
    const field = await edit({ name: 'Voo', value: 'G3 1234' })

    expect(field.updatedById).toBeNull()
    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
  })

  it('answers NOT_FOUND for a Field that is not of the item', async () => {
    await expect(edit({ value: 'x' }, ANA, 42)).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('forbids a Viewer', async () => {
    arranged.deps.directory.addMember(1, 3, 'VIEWER')

    await expect(edit({ value: 'x' }, { id: 3, isSuperAdmin: false })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('refuses editing a Field of a Cancelled Event with EVENT_CANCELLED, keeping it', async () => {
    await arranged.cancelEvent()

    await expect(edit({ value: 'x' }, SUPER_ADMIN)).rejects.toEqual(new AppError('EVENT_CANCELLED'))
    expect(arranged.deps.fields.ofItem(arranged.itemId)[0]?.value.text).toBe('G3 1234')
  })

  it('refuses editing a Field of a Cancelled item with EVENT_ITEM_CANCELLED, keeping it', async () => {
    await arranged.cancelItem()

    await expect(edit({ value: 'x' }, SUPER_ADMIN)).rejects.toEqual(
      new AppError('EVENT_ITEM_CANCELLED'),
    )
    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
  })
})
