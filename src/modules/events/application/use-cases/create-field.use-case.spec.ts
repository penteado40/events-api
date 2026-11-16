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

    const { field } = await create()

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

    const { field } = await create()

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
    const { field } = await create(SUPER_ADMIN, 'Contato', '')

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

  describe('a people Field', () => {
    const MATIAS_ID = 4
    const JACQUE_ID = 5

    beforeEach(async () => {
      arranged.deps.directory.addMember(1, ANA.id, 'OWNER')
      await arranged.addParticipants(MATIAS_ID, JACQUE_ID)
      arranged.deps.users
        .add({ id: MATIAS_ID, name: 'Matias', phone: '+5592999990004' })
        .add({ id: JACQUE_ID, name: 'Jacque', phone: '+5592999990005' })
    })

    const createPeople = (people: ({ userId: number } | { name: string })[]) =>
      createField.execute({
        actor: ANA,
        eventId: arranged.eventId,
        itemId: arranged.itemId,
        kind: 'PEOPLE',
        name: 'Carro 1 - EC',
        people,
      })
    const users = (...ids: number[]) => ids.map((userId) => ({ userId }))

    it('adds the people in the order given, and answers them by name', async () => {
      const { field, shown } = await createPeople(users(MATIAS_ID, JACQUE_ID))

      expect(field.value).toEqual({ kind: 'PEOPLE', people: users(MATIAS_ID, JACQUE_ID) })
      expect(shown).toEqual({
        id: field.id,
        kind: 'PEOPLE',
        name: 'Carro 1 - EC',
        value: [
          { userId: MATIAS_ID, name: 'Matias' },
          { userId: JACQUE_ID, name: 'Jacque' },
        ],
      })
    })

    it('records a Change whose reach after takes in who is in the Field, out of the Audience chosen', async () => {
      await arranged.chooseAudience(JACQUE_ID)

      const { field } = await createPeople(users(MATIAS_ID))

      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
        expect.objectContaining({
          attribute: 'field',
          before: null,
          after: {
            fieldId: field.id,
            kind: 'PEOPLE',
            name: 'Carro 1 - EC',
            value: users(MATIAS_ID),
          },
          productionOnly: false,
          reachBefore: [ANA.id, JACQUE_ID],
          reachAfter: [ANA.id, MATIAS_ID, JACQUE_ID],
        }),
      ])
    })

    it('refuses who is not a Participant with NOT_A_PARTICIPANT, writing nothing', async () => {
      await expect(createPeople(users(MATIAS_ID, 99))).rejects.toEqual(
        new AppError('NOT_A_PARTICIPANT'),
      )
      expect(arranged.deps.fields.ofItem(arranged.itemId)).toEqual([])
      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([])
    })

    it('refuses a person twice, or a text value, with VALIDATION_ERROR', async () => {
      await expect(createPeople(users(MATIAS_ID, MATIAS_ID))).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
      await expect(
        createField.execute({
          actor: ANA,
          eventId: arranged.eventId,
          itemId: arranged.itemId,
          kind: 'PEOPLE',
          name: 'Carro 1 - EC',
          value: 'Matias',
        }),
      ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    })

    it('accepts a people Field with no one yet', async () => {
      const { field } = await createPeople([])

      expect(field.value).toEqual({ kind: 'PEOPLE', people: [] })
    })

    it('puts a loose name among the Users, in the order given, shown with the name only', async () => {
      const { field, shown } = await createPeople([
        { userId: MATIAS_ID },
        { name: '  Seu Raimundo (motorista) ' },
      ])

      expect(field.value).toEqual({
        kind: 'PEOPLE',
        people: [{ userId: MATIAS_ID }, { name: 'Seu Raimundo (motorista)' }],
      })
      expect(shown.value).toEqual([
        { userId: MATIAS_ID, name: 'Matias' },
        { name: 'Seu Raimundo (motorista)' },
      ])
    })

    it('records the loose name in the Change, leaving the reach as the Users make it', async () => {
      await arranged.chooseAudience(JACQUE_ID)

      const { field } = await createPeople([{ name: 'Seu Raimundo' }])

      expect(arranged.deps.changeLog.ofEvent(arranged.eventId)).toEqual([
        expect.objectContaining({
          attribute: 'field',
          before: null,
          after: {
            fieldId: field.id,
            kind: 'PEOPLE',
            name: 'Carro 1 - EC',
            value: [{ name: 'Seu Raimundo' }],
          },
          reachBefore: [ANA.id, JACQUE_ID],
          reachAfter: [ANA.id, JACQUE_ID],
        }),
      ])
    })

    it('refuses an empty loose name, or the same one twice, with VALIDATION_ERROR', async () => {
      await expect(createPeople([{ name: '   ' }])).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
      await expect(createPeople([{ name: 'Raimundo' }, { name: ' Raimundo' }])).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
      expect(arranged.deps.fields.ofItem(arranged.itemId)).toEqual([])
    })
  })
})
