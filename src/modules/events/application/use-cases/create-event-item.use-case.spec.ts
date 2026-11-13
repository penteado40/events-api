import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { CreateEventItemUseCase } from './create-event-item.use-case.js'

const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('CreateEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let createItem: CreateEventItemUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    createItem = new CreateEventItemUseCase(
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
      { by: null, at: NOW },
    )
    eventId = event.id
  })

  it('lets an Owner create a published Event item with a local date and time, in the zone of the Event', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { item, when } = await createItem.execute({
      actor: ANA,
      eventId,
      name: ' Show no Teatro Amazonas ',
      date: '2026-11-14',
      time: '19:00',
    })

    expect(item).toMatchObject({
      eventId,
      name: 'Show no Teatro Amazonas',
      place: null,
      state: 'PUBLISHED',
      createdAt: NOW,
      createdById: ANA.id,
    })
    expect(when).toEqual({ date: '2026-11-14', time: '19:00', timezone: 'America/Manaus' })
    expect(items.ofEvent(eventId)).toHaveLength(1)
  })

  it('keeps the place as written, its zone ruling the when', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { item, when } = await createItem.execute({
      actor: ANA,
      eventId,
      name: 'Técnica viaja para Manaus',
      date: '2026-11-12',
      time: '08:00',
      place: {
        name: ' Aeroporto de Guarulhos ',
        address: 'Rod. Hélio Smidt, s/n',
        timezone: 'America/Sao_Paulo',
      },
    })

    expect(item.place?.toValues()).toEqual({
      name: 'Aeroporto de Guarulhos',
      address: 'Rod. Hélio Smidt, s/n',
      timezone: 'America/Sao_Paulo',
    })
    expect(when).toEqual({ date: '2026-11-12', time: '08:00', timezone: 'America/Sao_Paulo' })
  })

  it('creates an item of the General info, with no date', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { when } = await createItem.execute({ actor: ANA, eventId, name: 'O que levar' })

    expect(when).toBeNull()
  })

  it('refuses a time with no date with EVENT_ITEM_TIME_WITHOUT_DATE', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await expect(
      createItem.execute({ actor: ANA, eventId, name: 'Show', time: '19:00' }),
    ).rejects.toEqual(new AppError('EVENT_ITEM_TIME_WITHOUT_DATE'))
    expect(items.ofEvent(eventId)).toEqual([])
  })

  it('refuses a place with no name, address or zone with VALIDATION_ERROR', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await expect(
      createItem.execute({ actor: ANA, eventId, name: 'Show', place: { name: '  ' } }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })

  it('lets the Super admin create an Event item', async () => {
    const { item } = await createItem.execute({ actor: SUPER_ADMIN, eventId, name: 'O que levar' })

    expect(item.createdById).toBe(SUPER_ADMIN.id)
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(createItem.execute({ actor: ANA, eventId, name: 'Show' })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND to who is not a Group member of its Group, and for an Event that does not exist', async () => {
    await expect(createItem.execute({ actor: ANA, eventId, name: 'Show' })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(
      createItem.execute({ actor: SUPER_ADMIN, eventId: 42, name: 'Show' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })
  async function cancelEvent(): Promise<void> {
    const event = await events.findById(eventId)
    event!.cancel({ by: null, at: NOW })
    await events.save(event!)
  }

  it('refuses creating an item in a Cancelled Event with EVENT_CANCELLED, creating nothing', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    await cancelEvent()

    await expect(createItem.execute({ actor: ANA, eventId, name: 'Bis' })).rejects.toEqual(
      new AppError('EVENT_CANCELLED'),
    )
    expect(items.ofEvent(eventId)).toEqual([])
  })
})
