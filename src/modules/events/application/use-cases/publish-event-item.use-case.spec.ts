import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
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
import { InMemoryParticipantRepository } from '../testing/in-memory-participant.repository.js'
import { PublishEventItemUseCase } from './publish-event-item.use-case.js'

const AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('PublishEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let changeLog: InMemoryChangeRepository
  let participants: InMemoryParticipantRepository
  let publishItem: PublishEventItemUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    changeLog = new InMemoryChangeRepository()
    participants = new InMemoryParticipantRepository(events)
    publishItem = new PublishEventItemUseCase(
      directory,
      events,
      items,
      participants,
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

  it('lets an Owner publish an Event item in Draft, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    const itemId = await itemIn('DRAFT')

    const { item, when } = await publishItem.execute({ actor: ANA, eventId, itemId })

    expect(item).toMatchObject({
      id: itemId,
      state: 'PUBLISHED',
      updatedAt: NOW,
      updatedById: ANA.id,
    })
    expect(when).toEqual({ date: '2026-11-14', time: '22:00', timezone: 'America/Manaus' })
    expect(items.ofEvent(eventId)[0]!.state).toBe('PUBLISHED')
  })

  it('records the publication as a Change of the state of the item, by its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, 3, 'VIEWER')
    const itemId = await itemIn('DRAFT')

    await publishItem.execute({ actor: ANA, eventId, itemId })

    expect(changeLog.ofEvent(eventId)).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'state',
        before: 'DRAFT',
        after: 'PUBLISHED',
        productionOnly: false,
        reachBefore: [ANA.id],
        reachAfter: [ANA.id],
        by: ANA.id,
        at: NOW,
      }),
    ])
  })

  it('reaches the Participants once published in a published Event, and only the Owners before', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, 3, 'VIEWER').addMember(1, 4, 'VIEWER')
    await participants.create(eventId, [3], { by: null, at: AT })
    const event = await events.findById(eventId)
    event!.publish({ by: null, at: AT })
    await events.save(event!)
    const itemId = await itemIn('DRAFT')

    await publishItem.execute({ actor: ANA, eventId, itemId })

    expect(changeLog.ofEvent(eventId)).toEqual([
      expect.objectContaining({
        attribute: 'state',
        reachBefore: [ANA.id],
        reachAfter: [ANA.id, 3],
      }),
    ])
  })

  it('lets the Super admin publish an Event item in Draft', async () => {
    const itemId = await itemIn('DRAFT')

    const { item } = await publishItem.execute({ actor: SUPER_ADMIN, eventId, itemId })

    expect(item.state).toBe('PUBLISHED')
  })

  it('refuses a published item with EVENT_ITEM_NOT_DRAFT, writing nothing', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    const itemId = await itemIn('PUBLISHED')

    await expect(publishItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('EVENT_ITEM_NOT_DRAFT'),
    )
    expect(items.ofEvent(eventId)[0]!.updatedAt).toBe(AT)
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, keeping the item in Draft', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    const itemId = await itemIn('DRAFT')

    await expect(publishItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(items.ofEvent(eventId)[0]!.state).toBe('DRAFT')
  })

  it('answers NOT_FOUND for an item that does not exist, and to who is not a Group member', async () => {
    const itemId = await itemIn('DRAFT')

    await expect(publishItem.execute({ actor: SUPER_ADMIN, eventId, itemId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(publishItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('refuses publishing an item of a Cancelled Event with EVENT_CANCELLED, keeping it in Draft', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    const itemId = await itemIn('DRAFT')
    const event = await events.findById(eventId)
    event!.cancel({ by: null, at: AT })
    await events.save(event!)

    await expect(publishItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('EVENT_CANCELLED'),
    )
    expect(items.ofEvent(eventId)[0]!.state).toBe('DRAFT')
    expect(changeLog.ofEvent(eventId)).toEqual([])
  })
})
