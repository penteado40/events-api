import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryChangeRepository } from '../testing/in-memory-change.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { CancelEventUseCase } from './cancel-event.use-case.js'
import { PublishEventUseCase } from './publish-event.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')
const BIA = 3

describe('CancelEventUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let changes: InMemoryChangeRepository
  let unitOfWork: InMemoryUnitOfWork
  let cancelEvent: CancelEventUseCase
  let publishEvent: PublishEventUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    changes = new InMemoryChangeRepository()
    unitOfWork = new InMemoryUnitOfWork()
    const clock = new FixedClock(NOW)
    cancelEvent = new CancelEventUseCase(directory, events, changes, unitOfWork, clock)
    publishEvent = new PublishEventUseCase(directory, events, changes, unitOfWork, clock)
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
  })

  it('lets an Owner cancel an Event in Draft, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { event, isFinished } = await cancelEvent.execute({ actor: ANA, eventId })

    expect(event).toMatchObject({ state: 'CANCELLED', updatedAt: NOW, updatedById: ANA.id })
    expect(isFinished).toBe(false)
    expect((await events.findById(eventId))?.state).toBe('CANCELLED')
  })

  it('records the Change of state, by the Author, reaching every Group member, in one unit of work', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, BIA, 'VIEWER').addMember(2, 99, 'OWNER')
    await publishEvent.execute({ actor: ANA, eventId })

    await cancelEvent.execute({ actor: ANA, eventId })

    expect(changes.ofEvent(eventId)[1]).toEqual({
      id: expect.any(Number),
      eventId,
      eventItemId: null,
      attribute: 'state',
      before: 'PUBLISHED',
      after: 'CANCELLED',
      productionOnly: false,
      reachBefore: [ANA.id, BIA],
      reachAfter: [ANA.id, BIA],
      by: ANA.id,
      at: NOW,
    })
    expect(unitOfWork.runs()).toBe(2)
  })

  it('lets the Super admin cancel the Event', async () => {
    const { event } = await cancelEvent.execute({ actor: SUPER_ADMIN, eventId })

    expect(event).toMatchObject({ state: 'CANCELLED', updatedById: SUPER_ADMIN.id })
  })

  it('refuses an Event already Cancelled with EVENT_CANCELLED, recording no new Change', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    await cancelEvent.execute({ actor: ANA, eventId })

    await expect(cancelEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('EVENT_CANCELLED'),
    )
    expect(changes.ofEvent(eventId)).toHaveLength(1)
  })

  it('refuses a Viewer with FORBIDDEN, leaving the Event as it was', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(cancelEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect((await events.findById(eventId))?.state).toBe('DRAFT')
    expect(changes.ofEvent(eventId)).toEqual([])
  })

  it('answers NOT_FOUND to who is not a Group member of its Group, and for an Event that does not exist', async () => {
    await expect(cancelEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(cancelEvent.execute({ actor: SUPER_ADMIN, eventId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
