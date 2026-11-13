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
import { InMemoryChangeRepository } from '../testing/in-memory-change.repository.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { DeleteEventItemUseCase } from './delete-event-item.use-case.js'

const AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('DeleteEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let changeLog: InMemoryChangeRepository
  let deleteItem: DeleteEventItemUseCase
  let eventId: number
  let itemId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    changeLog = new InMemoryChangeRepository()
    deleteItem = new DeleteEventItemUseCase(
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
          name: EventName.create('Show em Manaus'),
          place: EventPlace.create('Manaus'),
          period: EventPeriod.create(MANAUS_PERIOD),
        },
        { by: null, at: AT },
      )
    ).id
    itemId = (
      await items.create(
        {
          eventId,
          name: EventItemName.create('O que levar'),
          start: EventItemStart.create({ date: null, time: null }),
          place: null,
        },
        { by: null, at: AT },
      )
    ).id
  })

  it('lets an Owner delete an Event item', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await deleteItem.execute({ actor: ANA, eventId, itemId })

    expect(items.ofEvent(eventId)).toEqual([])
  })

  it('records the removal as a Change of the item, by its Author, reaching no one after it', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, 3, 'VIEWER')

    await deleteItem.execute({ actor: ANA, eventId, itemId })

    expect(changeLog.ofEvent(eventId)).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'item',
        before: { name: 'O que levar', date: null, time: null, place: null, state: 'PUBLISHED' },
        after: null,
        reachBefore: [ANA.id],
        reachAfter: [],
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('lets the Super admin delete an Event item', async () => {
    await deleteItem.execute({ actor: SUPER_ADMIN, eventId, itemId })

    expect(items.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, keeping the item', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(deleteItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(items.ofEvent(eventId)).toHaveLength(1)
  })

  it('answers NOT_FOUND for an item that does not exist, and to who is not a Group member', async () => {
    await expect(deleteItem.execute({ actor: SUPER_ADMIN, eventId, itemId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(deleteItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
  async function cancelEvent(): Promise<void> {
    const event = await events.findById(eventId)
    event!.cancel({ by: null, at: AT })
    await events.save(event!)
  }

  it('refuses deleting an item of a Cancelled Event with EVENT_CANCELLED, keeping it', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    await cancelEvent()

    await expect(deleteItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('EVENT_CANCELLED'),
    )
    expect(items.ofEvent(eventId)).toHaveLength(1)
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })
})
