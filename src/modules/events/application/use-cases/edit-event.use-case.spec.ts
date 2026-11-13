import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { EditEventUseCase } from './edit-event.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
// Two weeks after the Manaus trip: a Finished event.
const NOW = new Date('2026-11-30T12:00:00.000Z')

describe('EditEventUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let editEvent: EditEventUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    editEvent = new EditEventUseCase(directory, events, new FixedClock(NOW))
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

  it('lets an Owner edit the name, the place and the period of a Finished event, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { event, isFinished } = await editEvent.execute({
      actor: ANA,
      eventId,
      name: ' Shows em Manaus ',
      place: ' Teatro Amazonas ',
      period: { startDate: '2026-11-12', endDate: '2026-11-16', timezone: 'America/Manaus' },
    })

    expect(event).toMatchObject({
      name: 'Shows em Manaus',
      place: 'Teatro Amazonas',
      state: 'DRAFT',
      createdAt: CREATED_AT,
      updatedAt: NOW,
      updatedById: ANA.id,
    })
    expect(event.period.startDate.value).toBe('2026-11-12')
    expect(isFinished).toBe(true)
    expect((await events.findById(eventId))?.name).toBe('Shows em Manaus')
  })

  it('changes only what is sent', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { event } = await editEvent.execute({ actor: ANA, eventId, place: 'Teatro Amazonas' })

    expect(event).toMatchObject({ name: 'Show em Manaus', place: 'Teatro Amazonas' })
    expect(event.period.endDate.value).toBe('2026-11-16')
  })

  it('moves a Finished event back to the future when the period moves', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { isFinished } = await editEvent.execute({
      actor: ANA,
      eventId,
      period: { startDate: '2026-12-10', endDate: '2026-12-12', timezone: 'America/Manaus' },
    })

    expect(isFinished).toBe(false)
  })

  it('lets the Super admin edit the Event', async () => {
    const { event } = await editEvent.execute({ actor: SUPER_ADMIN, eventId, name: 'Turnê' })

    expect(event.updatedById).toBe(SUPER_ADMIN.id)
  })

  it('refuses an end date before the start date with EVENT_PERIOD_INVALID, leaving the Event as it was', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await expect(
      editEvent.execute({
        actor: ANA,
        eventId,
        name: 'Turnê',
        period: { startDate: '2026-11-16', endDate: '2026-11-13', timezone: 'America/Manaus' },
      }),
    ).rejects.toEqual(new AppError('EVENT_PERIOD_INVALID'))
    expect((await events.findById(eventId))?.name).toBe('Show em Manaus')
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(editEvent.execute({ actor: ANA, eventId, name: 'Turnê' })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND to who is not a Group member of its Group, and for an Event that does not exist', async () => {
    await expect(editEvent.execute({ actor: ANA, eventId, name: 'Turnê' })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(
      editEvent.execute({ actor: SUPER_ADMIN, eventId: 42, name: 'Turnê' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })
})
