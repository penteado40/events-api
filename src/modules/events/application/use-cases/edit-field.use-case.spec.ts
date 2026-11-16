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

  const edit = (
    change: { name?: string; value?: string; userIds?: number[] },
    actor = ANA,
    id = fieldId,
  ) =>
    editField.execute({
      actor,
      eventId: arranged.eventId,
      itemId: arranged.itemId,
      fieldId: id,
      ...change,
    })

  it('lets an Owner change the value, as its Author, keeping the name', async () => {
    const { field } = await edit({ value: 'G3 1250' })

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
    const { field } = await edit({ name: 'Voo', value: 'G3 1234' })

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
    expect(arranged.deps.fields.ofItem(arranged.itemId)[0]?.value).toEqual({
      kind: 'TEXT',
      text: 'G3 1234',
    })
  })

  it('refuses editing a Field of a Cancelled item with EVENT_ITEM_CANCELLED, keeping it', async () => {
    await arranged.cancelItem()

    await expect(edit({ value: 'x' }, SUPER_ADMIN)).rejects.toEqual(
      new AppError('EVENT_ITEM_CANCELLED'),
    )
    expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
  })

  it('refuses people for a text Field with VALIDATION_ERROR', async () => {
    await expect(edit({ userIds: [] })).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })

  describe('a people Field', () => {
    const MATIAS_ID = 4
    const JACQUE_ID = 5
    let carId: number

    beforeEach(async () => {
      await arranged.addParticipants(MATIAS_ID, JACQUE_ID)
      arranged.deps.users
        .add({ id: MATIAS_ID, name: 'Matias', phone: '+5592999990004' })
        .add({ id: JACQUE_ID, name: 'Jacque', phone: '+5592999990005' })
      // The item is only for whom the production chooses: no one.
      await arranged.chooseAudience()
      carId = await arranged.addPeopleField('Carro 1 - EC', [MATIAS_ID])
    })

    const editCar = (userIds: number[]) => edit({ userIds }, ANA, carId)

    it('puts people in, in the new order, and answers them by name', async () => {
      const { field, shown } = await editCar([JACQUE_ID, MATIAS_ID])

      expect(field.value).toEqual({ kind: 'PEOPLE', userIds: [JACQUE_ID, MATIAS_ID] })
      expect(shown.value).toEqual([
        { userId: JACQUE_ID, name: 'Jacque' },
        { userId: MATIAS_ID, name: 'Matias' },
      ])
    })

    it('records putting someone in as a Change with the reach before and after', async () => {
      await editCar([MATIAS_ID, JACQUE_ID])

      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
        expect.objectContaining({
          attribute: 'field',
          before: { fieldId: carId, kind: 'PEOPLE', name: 'Carro 1 - EC', value: [MATIAS_ID] },
          after: {
            fieldId: carId,
            kind: 'PEOPLE',
            name: 'Carro 1 - EC',
            value: [MATIAS_ID, JACQUE_ID],
          },
          reachBefore: [ANA.id, MATIAS_ID],
          reachAfter: [ANA.id, MATIAS_ID, JACQUE_ID],
        }),
      ])
    })

    it('records taking someone out as a Change whose reach after leaves them out', async () => {
      await editCar([])

      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
        expect.objectContaining({ reachBefore: [ANA.id, MATIAS_ID], reachAfter: [ANA.id] }),
      ])
    })

    it('keeps reaching someone taken out of one Field while in another of the item', async () => {
      await arranged.addPeopleField('Carro 2', [MATIAS_ID])

      await editCar([])

      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
        expect.objectContaining({
          reachBefore: [ANA.id, MATIAS_ID],
          reachAfter: [ANA.id, MATIAS_ID],
        }),
      ])
    })

    it('writes nothing for the same people in the same order', async () => {
      await editCar([MATIAS_ID])

      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
    })

    it('refuses who is not a Participant with NOT_A_PARTICIPANT, keeping the Field', async () => {
      await expect(editCar([MATIAS_ID, 99])).rejects.toEqual(new AppError('NOT_A_PARTICIPANT'))
      expect(arranged.deps.fields.ofItem(arranged.itemId)[1]?.value).toEqual({
        kind: 'PEOPLE',
        userIds: [MATIAS_ID],
      })
    })

    it('keeps who left the Event in the Field while someone else comes in', async () => {
      await arranged.deps.participants.remove(arranged.eventId, MATIAS_ID)

      const { field } = await editCar([MATIAS_ID, JACQUE_ID])

      expect(field.value).toEqual({ kind: 'PEOPLE', userIds: [MATIAS_ID, JACQUE_ID] })
    })

    it('refuses a text value for a people Field with VALIDATION_ERROR', async () => {
      await expect(edit({ value: 'Matias' }, ANA, carId)).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
    })
  })
})
