import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { assembleSchedule } from '../../domain/schedule.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryChangeRepository } from '../testing/in-memory-change.repository.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventScheduleReader } from '../testing/in-memory-event-schedule-reader.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { ReorderEventItemsUseCase } from './reorder-event-items.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')
const BRUNO_ID = 3

describe('ReorderEventItemsUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let changeLog: InMemoryChangeRepository
  let reorder: ReorderEventItemsUseCase
  let eventId: number
  const ids: Record<string, number> = {}

  async function addItem(name: string, start: { date?: string; time?: string } = {}) {
    const item = await items.create(
      {
        eventId,
        name: EventItemName.create(name),
        start: EventItemStart.create({ date: start.date ?? null, time: start.time ?? null }),
        place: null,
      },
      { by: null, at: CREATED_AT },
    )
    ids[name] = item.id
  }

  async function schedule() {
    const data = await new InMemoryEventScheduleReader(events, items).load(eventId)
    return assembleSchedule(data!)
  }

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1).addMember(1, BRUNO_ID, 'VIEWER')
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    changeLog = new InMemoryChangeRepository()
    reorder = new ReorderEventItemsUseCase(
      directory,
      events,
      items,
      changeLog,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
    eventId = (
      await events.create(
        {
          groupId: 1,
          name: EventName.create('Shows em Manaus'),
          place: EventPlace.create('Manaus'),
          period: EventPeriod.create(MANAUS_PERIOD),
        },
        { by: null, at: CREATED_AT },
      )
    ).id
    await addItem('O que levar')
    await addItem('Van 1', { date: '2026-11-13', time: '10:00' })
    await addItem('Contatos da produção')
    await addItem('Van 2', { date: '2026-11-13', time: '10:00' })
    await addItem('Café', { date: '2026-11-13', time: '09:00' })
  })

  it('lets an Owner put the General info in a new order', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await reorder.execute({
      actor: ANA,
      eventId,
      itemIds: [ids['Contatos da produção']!, ids['O que levar']!],
    })

    expect((await schedule()).generalInfo.map((i) => i.name)).toEqual([
      'Contatos da produção',
      'O que levar',
    ])
  })

  it('reorders two items at the same time, never before an earlier time', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await reorder.execute({ actor: ANA, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] })

    expect((await schedule()).timeline[0]?.items.map((i) => i.name)).toEqual([
      'Café',
      'Van 2',
      'Van 1',
    ])
  })

  it('records the new order as one Change of the Event only the production sees, by its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await reorder.execute({ actor: ANA, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] })

    expect(changeLog.ofEvent(eventId)).toEqual([
      expect.objectContaining({
        eventItemId: null,
        attribute: 'itemOrder',
        before: [ids['Van 1'], ids['Van 2']],
        after: [ids['Van 2'], ids['Van 1']],
        productionOnly: true,
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('records nothing when the order is the same', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await reorder.execute({ actor: ANA, eventId, itemIds: [ids['Van 1']!, ids['Van 2']!] })

    expect(changeLog.ofEvent(eventId)).toEqual([])
  })

  it('lets the Super admin reorder', async () => {
    await reorder.execute({ actor: SUPER_ADMIN, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] })

    expect(changeLog.ofEvent(eventId)[0]?.by).toBe(SUPER_ADMIN.id)
  })

  it('refuses items where the time decides with EVENT_ITEM_ORDER_MIXED, keeping the order', async () => {
    await expect(
      reorder.execute({
        actor: SUPER_ADMIN,
        eventId,
        itemIds: [ids['Van 1']!, ids['Van 2']!, ids['Café']!],
      }),
    ).rejects.toEqual(new AppError('EVENT_ITEM_ORDER_MIXED'))
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })

  it('refuses a group left incomplete with EVENT_ITEM_ORDER_INCOMPLETE', async () => {
    await addItem('Van 3', { date: '2026-11-13', time: '10:00' })

    await expect(
      reorder.execute({ actor: SUPER_ADMIN, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] }),
    ).rejects.toEqual(new AppError('EVENT_ITEM_ORDER_INCOMPLETE'))
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(
      reorder.execute({ actor: ANA, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('answers NOT_FOUND for an unknown Event, an item of another Event, and who is not a Group member', async () => {
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
      reorder.execute({ actor: SUPER_ADMIN, eventId: 999, itemIds: [ids['Van 1']!] }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    await expect(
      reorder.execute({ actor: SUPER_ADMIN, eventId: other.id, itemIds: [ids['Van 1']!] }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    await expect(
      reorder.execute({ actor: ANA, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('refuses reordering in a Cancelled Event with EVENT_CANCELLED', async () => {
    const event = await events.findById(eventId)
    event!.cancel({ by: null, at: NOW })
    await events.save(event!)

    await expect(
      reorder.execute({ actor: SUPER_ADMIN, eventId, itemIds: [ids['Van 2']!, ids['Van 1']!] }),
    ).rejects.toEqual(new AppError('EVENT_CANCELLED'))
    expect((await schedule()).timeline[0]?.items.map((i) => i.name)).toEqual([
      'Café',
      'Van 1',
      'Van 2',
    ])
  })
})
