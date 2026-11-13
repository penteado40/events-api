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
import { EditEventUseCase } from './edit-event.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
// Two weeks after the Manaus trip: a Finished event.
const NOW = new Date('2026-11-30T12:00:00.000Z')

describe('EditEventUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let changes: InMemoryChangeRepository
  let unitOfWork: InMemoryUnitOfWork
  let editEvent: EditEventUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    changes = new InMemoryChangeRepository()
    unitOfWork = new InMemoryUnitOfWork()
    editEvent = new EditEventUseCase(directory, events, changes, unitOfWork, new FixedClock(NOW))
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

  describe('Changes', () => {
    const BIA = 3

    beforeEach(() => {
      directory.addMember(1, ANA.id, 'OWNER').addMember(1, BIA, 'VIEWER').addMember(2, 99, 'OWNER')
    })

    it('records one Change per attribute that changed, by the Author, at the instant of the Clock', async () => {
      await editEvent.execute({
        actor: ANA,
        eventId,
        name: 'Shows em Manaus',
        place: 'Manaus',
        period: { startDate: '2026-11-12', endDate: '2026-11-16', timezone: 'America/Manaus' },
      })

      expect(changes.ofEvent(eventId)).toEqual([
        {
          id: expect.any(Number),
          eventId,
          attribute: 'name',
          before: 'Show em Manaus',
          after: 'Shows em Manaus',
          productionOnly: false,
          reachBefore: [ANA.id, BIA],
          reachAfter: [ANA.id, BIA],
          by: ANA.id,
          at: NOW,
        },
        {
          id: expect.any(Number),
          eventId,
          attribute: 'period',
          before: { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' },
          after: { startDate: '2026-11-12', endDate: '2026-11-16', timezone: 'America/Manaus' },
          productionOnly: false,
          reachBefore: [ANA.id, BIA],
          reachAfter: [ANA.id, BIA],
          by: ANA.id,
          at: NOW,
        },
      ])
    })

    it('records no Change, and leaves the Event untouched, when nothing changed', async () => {
      const { event } = await editEvent.execute({
        actor: ANA,
        eventId,
        name: ' Show em Manaus ',
        period: MANAUS_PERIOD,
      })

      expect(changes.ofEvent(eventId)).toEqual([])
      expect(event).toMatchObject({ updatedAt: CREATED_AT, updatedById: null })
    })

    it('records the Changes of the Super admin, who is not in the reach (not a Group member)', async () => {
      await editEvent.execute({ actor: SUPER_ADMIN, eventId, place: 'Teatro Amazonas' })

      expect(changes.ofEvent(eventId)).toMatchObject([
        { attribute: 'place', by: SUPER_ADMIN.id, reachBefore: [ANA.id, BIA] },
      ])
    })

    it('writes the Event and its Changes in one unit of work', async () => {
      await editEvent.execute({ actor: ANA, eventId, name: 'Turnê' })

      expect(unitOfWork.runs()).toBe(1)
    })

    it('records no Change when the edit is refused', async () => {
      await expect(
        editEvent.execute({
          actor: ANA,
          eventId,
          name: 'Turnê',
          period: { startDate: '2026-11-16', endDate: '2026-11-13', timezone: 'America/Manaus' },
        }),
      ).rejects.toEqual(new AppError('EVENT_PERIOD_INVALID'))
      expect(changes.ofEvent(eventId)).toEqual([])
    })
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
