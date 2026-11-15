import { beforeEach, describe, expect, it } from 'vitest'
import { AppError, type ErrorCode } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { positionAfter } from '../../domain/event-item-order.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import type { EventItemState } from '../../domain/event-item.entity.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryChangeRepository } from '../testing/in-memory-change.repository.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { inMemoryEventItemWriteDeps } from '../testing/in-memory-event-item-write-deps.js'
import { CancelEventItemUseCase } from './cancel-event-item.use-case.js'

const AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('CancelEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let changeLog: InMemoryChangeRepository
  let cancelItem: CancelEventItemUseCase
  let eventId: number

  beforeEach(async () => {
    const deps = inMemoryEventItemWriteDeps(NOW)
    ;({ directory, events, items, changeLog } = deps)
    directory.addGroup(1)
    cancelItem = new CancelEventItemUseCase(deps)
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
  })

  async function itemIn(state: EventItemState): Promise<number> {
    const item = await items.create(
      {
        eventId,
        name: EventItemName.create('Bis'),
        start: EventItemStart.create({ date: '2026-11-14', time: '22:00' }),
        place: null,
        state,
        position: positionAfter(items.ofEvent(eventId)),
      },
      { by: null, at: AT },
    )
    return item.id
  }

  it('lets an Owner cancel a published Event item, which stays in the schedule Cancelled, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    const itemId = await itemIn('PUBLISHED')

    const { item } = await cancelItem.execute({ actor: ANA, eventId, itemId })

    expect(item).toMatchObject({
      id: itemId,
      state: 'CANCELLED',
      updatedAt: NOW,
      updatedById: ANA.id,
    })
    expect(items.ofEvent(eventId).map((i) => i.state)).toEqual(['CANCELLED'])
  })

  it('records the cancel as a Change of the state of the item, by its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, 3, 'VIEWER')
    const itemId = await itemIn('PUBLISHED')

    await cancelItem.execute({ actor: ANA, eventId, itemId })

    expect(changeLog.ofEvent(eventId)).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'state',
        before: 'PUBLISHED',
        after: 'CANCELLED',
        productionOnly: false,
        reachBefore: [ANA.id],
        reachAfter: [ANA.id],
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('lets the Super admin cancel a published Event item', async () => {
    const itemId = await itemIn('PUBLISHED')

    const { item } = await cancelItem.execute({ actor: SUPER_ADMIN, eventId, itemId })

    expect(item.state).toBe('CANCELLED')
  })

  it.each<[EventItemState, ErrorCode]>([
    ['DRAFT', 'EVENT_ITEM_NOT_PUBLISHED'],
    ['CANCELLED', 'EVENT_ITEM_CANCELLED'],
  ])('refuses an item in %s with %s, writing nothing', async (state, code) => {
    directory.addMember(1, ANA.id, 'OWNER')
    const itemId = await itemIn(state)

    await expect(cancelItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError(code),
    )
    expect(items.ofEvent(eventId)[0]!.updatedAt).toBe(AT)
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, keeping the item published', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    const itemId = await itemIn('PUBLISHED')

    await expect(cancelItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(items.ofEvent(eventId)[0]!.state).toBe('PUBLISHED')
  })

  it('answers NOT_FOUND for an item that does not exist, and to who is not a Group member', async () => {
    const itemId = await itemIn('PUBLISHED')

    await expect(cancelItem.execute({ actor: SUPER_ADMIN, eventId, itemId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(cancelItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('refuses cancelling an item of a Cancelled Event with EVENT_CANCELLED, keeping it published', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    const itemId = await itemIn('PUBLISHED')
    const event = await events.findById(eventId)
    event!.cancel({ by: null, at: AT })
    await events.save(event!)

    await expect(cancelItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('EVENT_CANCELLED'),
    )
    expect(items.ofEvent(eventId)[0]!.state).toBe('PUBLISHED')
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })
})
