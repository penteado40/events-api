import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { ANA, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { arrangeFieldWrites } from '../testing/field-writes-fixture.js'
import { CreateFieldUseCase } from './create-field.use-case.js'

const NOW = new Date('2026-11-01T12:00:00.000Z')
const BRUNO_ID = 3

describe('CreateFieldUseCase', () => {
  let arranged: Awaited<ReturnType<typeof arrangeFieldWrites>>
  let createField: CreateFieldUseCase

  beforeEach(async () => {
    arranged = await arrangeFieldWrites(NOW)
    createField = new CreateFieldUseCase(arranged.deps)
  })

  const create = (actor = ANA, name = 'Obs', value = 'despachar som') =>
    createField.execute({
      actor,
      eventId: arranged.eventId,
      itemId: arranged.itemId,
      kind: 'TEXT',
      name,
      value,
    })

  it('lets an Owner add a text Field to an Event item, as its Author', async () => {
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER')

    const field = await create()

    expect(field.snapshot()).toMatchObject({
      eventItemId: arranged.itemId,
      name: 'Obs',
      value: { kind: 'TEXT', text: 'despachar som' },
    })
    expect(field).toMatchObject({ createdById: ANA.id, createdAt: NOW })
  })

  it('puts a new Field last among the Fields of the item', async () => {
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER')
    await arranged.addField('Voo', 'G3 1234')

    await create(ANA, 'Obs')

    expect(arranged.deps.fields.ofItem(arranged.itemId).map((f) => f.name)).toEqual(['Voo', 'Obs'])
  })

  it('records the new Field as a Change of the item that the people it reaches see', async () => {
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER').addMember(1, BRUNO_ID, 'VIEWER')
    await arranged.deps.participants.create(arranged.eventId, [BRUNO_ID], { by: null, at: NOW })

    const field = await create()

    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
      expect.objectContaining({
        eventItemId: arranged.itemId,
        attribute: 'field',
        before: null,
        after: { fieldId: field.id, kind: 'TEXT', name: 'Obs', value: 'despachar som' },
        productionOnly: false,
        reachBefore: [ANA.id, BRUNO_ID],
        reachAfter: [ANA.id, BRUNO_ID],
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('accepts a Field with no value yet', async () => {
    const field = await create(SUPER_ADMIN, 'Contato', '')

    expect(field.value).toEqual({ kind: 'TEXT', text: '' })
  })

  it('refuses a blank name with VALIDATION_ERROR', async () => {
    arranged.deps.directory.addMember(1, ANA.id, 'OWNER')

    await expect(create(ANA, '   ')).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })

  it('forbids a Viewer and answers NOT_FOUND to who is not a Group member', async () => {
    await expect(create(ANA)).rejects.toEqual(new AppError('NOT_FOUND'))
    arranged.deps.directory.addMember(1, ANA.id, 'VIEWER')
    await expect(create(ANA)).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(arranged.deps.fields.ofItem(arranged.itemId)).toEqual([])
  })

  it('answers NOT_FOUND for an item of another Event', async () => {
    await expect(
      createField.execute({
        actor: SUPER_ADMIN,
        eventId: arranged.eventId,
        itemId: 42,
        kind: 'TEXT',
        name: 'Obs',
        value: '',
      }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('refuses a Field in a Cancelled Event with EVENT_CANCELLED', async () => {
    await arranged.cancelEvent()

    await expect(create(SUPER_ADMIN)).rejects.toEqual(new AppError('EVENT_CANCELLED'))
    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
  })

  it('refuses a Field in a Cancelled item with EVENT_ITEM_CANCELLED', async () => {
    await arranged.cancelItem()

    await expect(create(SUPER_ADMIN)).rejects.toEqual(new AppError('EVENT_ITEM_CANCELLED'))
    expect(arranged.deps.fields.ofItem(arranged.itemId)).toEqual([])
  })
})
