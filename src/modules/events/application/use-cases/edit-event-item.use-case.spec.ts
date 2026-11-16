import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { positionAfter } from '../../domain/event-item-order.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FieldName } from '../../domain/field.entity.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryChangeRepository } from '../testing/in-memory-change.repository.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import type { InMemoryParticipantRepository } from '../testing/in-memory-participant.repository.js'
import { inMemoryEventItemWriteDeps } from '../testing/in-memory-event-item-write-deps.js'
import { EditEventItemUseCase } from './edit-event-item.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('EditEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let changeLog: InMemoryChangeRepository
  let participants: InMemoryParticipantRepository
  let fields: ReturnType<typeof inMemoryEventItemWriteDeps>['fields']
  let editItem: EditEventItemUseCase
  let eventId: number
  let itemId: number

  beforeEach(async () => {
    const deps = inMemoryEventItemWriteDeps(NOW)
    ;({ directory, events, items, changeLog, participants, fields } = deps)
    directory.addGroup(1)
    editItem = new EditEventItemUseCase(deps)
    const event = await events.create(
      {
        groupId: 1,
        name: EventName.create('Show em Manaus'),
        place: EventPlace.create('Manaus'),
        period: EventPeriod.create(MANAUS_PERIOD),
      },
      { by: null, at: CREATED_AT },
    )
    eventId = event.id
    const item = await items.create(
      {
        eventId,
        name: EventItemName.create('Passagem de som'),
        start: EventItemStart.create({ date: '2026-11-14', time: '15:00' }),
        place: null,
        position: positionAfter(items.ofEvent(eventId)),
        state: 'PUBLISHED',
      },
      { by: null, at: CREATED_AT },
    )
    itemId = item.id
  })

  it('lets an Owner change the name, the time and the place, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { item, when } = await editItem.execute({
      actor: ANA,
      eventId,
      itemId,
      name: 'Passagem de som (banda)',
      time: '16:00',
      place: { name: 'Teatro Amazonas', timezone: 'America/Manaus' },
    })

    expect(item).toMatchObject({
      name: 'Passagem de som (banda)',
      updatedAt: NOW,
      updatedById: ANA.id,
    })
    expect(item.place?.toValues()).toEqual({
      name: 'Teatro Amazonas',
      address: null,
      timezone: 'America/Manaus',
    })
    expect(when).toEqual({ date: '2026-11-14', time: '16:00', timezone: 'America/Manaus' })
  })

  it('records moving the Passagem de som from 15h to 16h as a Change of the time, by its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, 3, 'VIEWER')

    await editItem.execute({ actor: ANA, eventId, itemId, time: '16:00' })

    expect(changeLog.ofEvent(eventId)).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'time',
        before: '15:00',
        after: '16:00',
        reachBefore: [ANA.id],
        reachAfter: [ANA.id],
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('records one Change per attribute that changed', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await editItem.execute({
      actor: ANA,
      eventId,
      itemId,
      name: 'Passagem de som (banda)',
      date: '2026-11-15',
      time: '15:00',
      place: { name: 'Teatro Amazonas' },
    })

    expect(changeLog.ofEvent(eventId).map((c) => c.attribute)).toEqual(['name', 'date', 'place'])
  })

  it('clears the date and the time together, moving the item to the General info', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { when } = await editItem.execute({ actor: ANA, eventId, itemId, date: null, time: null })

    expect(when).toBeNull()
  })

  it('refuses clearing only the date, leaving a time with no date, with EVENT_ITEM_TIME_WITHOUT_DATE', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await expect(
      editItem.execute({ actor: ANA, eventId, itemId, name: 'Outro', date: null }),
    ).rejects.toEqual(new AppError('EVENT_ITEM_TIME_WITHOUT_DATE'))
    const [item] = items.ofEvent(eventId)
    expect(item?.snapshot()).toMatchObject({ name: 'Passagem de som', date: '2026-11-14' })
  })

  it('keeps the last Author when nothing changed', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { item } = await editItem.execute({ actor: ANA, eventId, itemId, time: '15:00' })

    expect(item).toMatchObject({ updatedAt: CREATED_AT, updatedById: null })
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })

  it('lets the Super admin edit the Event item', async () => {
    const { item } = await editItem.execute({ actor: SUPER_ADMIN, eventId, itemId, name: 'Som' })

    expect(item.updatedById).toBe(SUPER_ADMIN.id)
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(editItem.execute({ actor: ANA, eventId, itemId, name: 'Som' })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND for an item of another Event, and to who is not a Group member', async () => {
    const other = await events.create(
      {
        groupId: 1,
        name: EventName.create('Ensaio'),
        place: EventPlace.create('Sede'),
        period: EventPeriod.create(MANAUS_PERIOD),
      },
      { by: null, at: CREATED_AT },
    )

    await expect(
      editItem.execute({ actor: SUPER_ADMIN, eventId: other.id, itemId, name: 'Som' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    await expect(editItem.execute({ actor: ANA, eventId, itemId, name: 'Som' })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
  async function cancelEvent(): Promise<void> {
    const event = await events.findById(eventId)
    event!.cancel({ by: null, at: NOW })
    await events.save(event!)
  }

  it('refuses editing an item of a Cancelled Event with EVENT_CANCELLED, keeping it', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    await cancelEvent()

    await expect(
      editItem.execute({ actor: ANA, eventId, itemId, name: 'Outro nome' }),
    ).rejects.toEqual(new AppError('EVENT_CANCELLED'))
    expect(items.ofEvent(eventId)[0]?.name).toBe('Passagem de som')
  })

  it('refuses editing a Cancelled item with EVENT_ITEM_CANCELLED, writing nothing', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    const item = (await items.lockInEvent(eventId, itemId))!
    item.cancel({ by: null, at: CREATED_AT })
    await items.save(item)

    await expect(
      editItem.execute({ actor: ANA, eventId, itemId, name: 'Outro nome' }),
    ).rejects.toEqual(new AppError('EVENT_ITEM_CANCELLED'))
    expect(items.ofEvent(eventId)[0]?.name).toBe('Passagem de som')
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })

  describe('the Audience', () => {
    const BIA = 3
    const DUDA = 4

    /** A published Event where Ana (Owner), Bia and Duda (Viewers) are Participants; Edu (5) is a Viewer who does not go. */
    beforeEach(async () => {
      directory
        .addMember(1, ANA.id, 'OWNER')
        .addMember(1, BIA, 'VIEWER')
        .addMember(1, DUDA, 'VIEWER')
        .addMember(1, 5, 'VIEWER')
      await participants.create(eventId, [ANA.id, BIA, DUDA], { by: null, at: CREATED_AT })
      const event = await events.findById(eventId)
      event!.publish({ by: null, at: CREATED_AT })
      await events.save(event!)
    })

    it('lets an Owner choose the people, among the Participants, as its Author', async () => {
      const { item } = await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'SELECTED', userIds: [DUDA, BIA, DUDA] },
      })

      expect(item.audience.toValues()).toEqual({ kind: 'SELECTED', userIds: [BIA, DUDA] })
      expect(item).toMatchObject({ updatedAt: NOW, updatedById: ANA.id })
    })

    it('records the change of the Audience as a Change only the production sees, with the reach of before and of after', async () => {
      await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'SELECTED', userIds: [BIA] },
      })

      expect(changeLog.ofEvent(eventId)).toEqual([
        expect.objectContaining({
          eventItemId: itemId,
          attribute: 'audience',
          before: { kind: 'ALL' },
          after: { kind: 'SELECTED', userIds: [BIA] },
          productionOnly: true,
          reachBefore: [ANA.id, BIA, DUDA],
          reachAfter: [ANA.id, BIA],
          by: ANA.id,
          at: NOW,
        }),
      ])
    })

    it('gives the Audience back to "Todos"', async () => {
      await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'SELECTED', userIds: [BIA] },
      })

      const { item } = await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'ALL' },
      })

      expect(item.audience.toValues()).toEqual({ kind: 'ALL' })
      expect(changeLog.ofEvent(eventId).at(-1)).toMatchObject({
        attribute: 'audience',
        before: { kind: 'SELECTED', userIds: [BIA] },
        after: { kind: 'ALL' },
        reachBefore: [ANA.id, BIA],
        reachAfter: [ANA.id, BIA, DUDA],
      })
    })

    it('keeps whoever is in a people Field of the item in the reach of an Audience that leaves them out', async () => {
      await fields.create(
        {
          eventItemId: itemId,
          name: FieldName.create('Carro 1 - EC'),
          value: { kind: 'PEOPLE', people: [{ userId: DUDA }] },
          position: 1,
        },
        { by: null, at: CREATED_AT },
      )

      await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'SELECTED', userIds: [BIA] },
      })

      expect(changeLog.ofEvent(eventId)).toEqual([
        expect.objectContaining({
          attribute: 'audience',
          reachBefore: [ANA.id, BIA, DUDA],
          reachAfter: [ANA.id, BIA, DUDA],
        }),
      ])
    })

    it('refuses choosing who is not a Participant with NOT_A_PARTICIPANT, writing nothing', async () => {
      await expect(
        editItem.execute({
          actor: ANA,
          eventId,
          itemId,
          name: 'Outro nome',
          audience: { kind: 'SELECTED', userIds: [BIA, 5] },
        }),
      ).rejects.toEqual(new AppError('NOT_A_PARTICIPANT'))
      const [item] = items.ofEvent(eventId)
      expect(item?.snapshot()).toMatchObject({ name: 'Passagem de som', audience: { kind: 'ALL' } })
      expect(changeLog.ofEvent(eventId)).toEqual([])
    })

    it('writes nothing when the same people are chosen again', async () => {
      await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'SELECTED', userIds: [BIA] },
      })

      await editItem.execute({
        actor: ANA,
        eventId,
        itemId,
        audience: { kind: 'SELECTED', userIds: [BIA] },
      })

      expect(changeLog.ofEvent(eventId)).toHaveLength(1)
    })
  })
})
