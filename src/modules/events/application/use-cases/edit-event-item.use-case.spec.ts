import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { EditEventItemUseCase } from './edit-event-item.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('EditEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let editItem: EditEventItemUseCase
  let eventId: number
  let itemId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    editItem = new EditEventItemUseCase(
      directory,
      events,
      items,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
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
})
