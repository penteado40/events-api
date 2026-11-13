import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { GetEventUseCase } from './get-event.use-case.js'

describe('GetEventUseCase', () => {
  let directory: FakeGroupDirectory
  let clock: FixedClock
  let getEvent: GetEventUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    const events = new InMemoryEventRepository()
    clock = new FixedClock(new Date('2026-11-14T15:00:00.000Z'))
    getEvent = new GetEventUseCase(directory, events, clock)
    const event = await events.create(
      {
        groupId: 1,
        name: EventName.create('Show em Manaus'),
        place: EventPlace.create('Manaus'),
        period: EventPeriod.create(MANAUS_PERIOD),
      },
      { by: null, at: new Date('2026-10-01T12:00:00.000Z') },
    )
    eventId = event.id
  })

  it('shows the Event to a Viewer of its Group, Draft included', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    const { event, isFinished } = await getEvent.execute({ actor: ANA, eventId })

    expect(event).toMatchObject({ id: eventId, name: 'Show em Manaus', state: 'DRAFT' })
    expect(isFinished).toBe(false)
  })

  it('shows it as a Finished event once the end date is before today in the zone of the Event', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    clock.set(new Date('2026-11-17T04:00:00.000Z'))

    const { isFinished } = await getEvent.execute({ actor: ANA, eventId })

    expect(isFinished).toBe(true)
  })

  it('shows the Event to the Super admin', async () => {
    const { event } = await getEvent.execute({ actor: SUPER_ADMIN, eventId })

    expect(event.id).toBe(eventId)
  })

  it('answers NOT_FOUND to who is not a Group member of its Group, and for an Event that does not exist', async () => {
    directory.addMember(2, ANA.id, 'OWNER')

    await expect(getEvent.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(getEvent.execute({ actor: SUPER_ADMIN, eventId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
