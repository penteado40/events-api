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
import { UncancelEventUseCase } from './uncancel-event.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')
const BIA = 3

describe('UncancelEventUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let changes: InMemoryChangeRepository
  let unitOfWork: InMemoryUnitOfWork
  let uncancelEvent: UncancelEventUseCase
  let cancelEvent: CancelEventUseCase
  let publishEvent: PublishEventUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    changes = new InMemoryChangeRepository()
    unitOfWork = new InMemoryUnitOfWork()
    const clock = new FixedClock(NOW)
    uncancelEvent = new UncancelEventUseCase(directory, events, changes, unitOfWork, clock)
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

  it('lets an Owner give an Event cancelled in Draft back to Draft, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    await cancelEvent.execute({ actor: SUPER_ADMIN, eventId })

    const { event, isFinished } = await uncancelEvent.execute({ actor: ANA, eventId })

    expect(event).toMatchObject({ state: 'DRAFT', updatedAt: NOW, updatedById: ANA.id })
    expect(isFinished).toBe(false)
    expect((await events.findById(eventId))?.state).toBe('DRAFT')
  })

  it('gives an Event cancelled once published back to published, with the Change of state', async () => {
    directory.addMember(1, ANA.id, 'OWNER').addMember(1, BIA, 'VIEWER')
    await publishEvent.execute({ actor: ANA, eventId })
    await cancelEvent.execute({ actor: ANA, eventId })

    const { event } = await uncancelEvent.execute({ actor: ANA, eventId })

    expect(event.state).toBe('PUBLISHED')
    expect(changes.ofEvent(eventId).map((c) => [c.before, c.after])).toEqual([
      ['DRAFT', 'PUBLISHED'],
      ['PUBLISHED', 'CANCELLED'],
      ['CANCELLED', 'PUBLISHED'],
    ])
    expect(changes.ofEvent(eventId)[2]).toMatchObject({
      attribute: 'state',
      productionOnly: false,
      reachBefore: [ANA.id, BIA],
      reachAfter: [ANA.id, BIA],
      by: ANA.id,
      at: NOW,
    })
  })

  it('refuses an Event that is not Cancelled with EVENT_NOT_CANCELLED, recording no Change', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await expect(uncancelEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('EVENT_NOT_CANCELLED'),
    )
    expect(changes.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, leaving the Event Cancelled', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    await cancelEvent.execute({ actor: SUPER_ADMIN, eventId })

    await expect(uncancelEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect((await events.findById(eventId))?.state).toBe('CANCELLED')
  })

  it('answers NOT_FOUND to who is not a Group member of its Group, and for an Event that does not exist', async () => {
    await expect(uncancelEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(uncancelEvent.execute({ actor: SUPER_ADMIN, eventId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
