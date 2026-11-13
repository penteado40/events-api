import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { ListEventsUseCase } from './list-events.use-case.js'

const STAMP = { by: null, at: new Date('2026-10-01T12:00:00.000Z') }

describe('ListEventsUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let clock: FixedClock
  let listEvents: ListEventsUseCase

  async function arrange(groupId: number, name: string, period = MANAUS_PERIOD) {
    return events.create(
      {
        groupId,
        name: EventName.create(name),
        place: EventPlace.create('Manaus'),
        period: EventPeriod.create(period),
      },
      STAMP,
    )
  }

  beforeEach(() => {
    directory = new FakeGroupDirectory().addGroup(1).addGroup(2)
    events = new InMemoryEventRepository()
    // 22:30 of the 16th in Manaus (UTC-4): the last day of the Manaus trip.
    clock = new FixedClock(new Date('2026-11-17T02:30:00.000Z'))
    listEvents = new ListEventsUseCase(directory, events, clock)
  })

  it('lists the Events of the Group to a Viewer, Drafts included, by start date', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    await arrange(1, 'Show em Manaus')
    await arrange(1, 'Ensaio', {
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      timezone: 'America/Sao_Paulo',
    })
    await arrange(2, 'De outro Group')

    const views = await listEvents.execute({ actor: ANA, groupId: 1 })

    expect(views.map((v) => [v.event.name, v.event.state])).toEqual([
      ['Ensaio', 'DRAFT'],
      ['Show em Manaus', 'DRAFT'],
    ])
  })

  it('tells which are Finished events: the end date is before today in the zone of each Event', async () => {
    directory.addMember(1, ANA.id, 'OWNER')
    await arrange(1, 'Show em Manaus')
    // Same end date, but in Lisbon (UTC+0 in November) it is already 02:30 of the 17th.
    await arrange(1, 'Show em Lisboa', { ...MANAUS_PERIOD, timezone: 'Europe/Lisbon' })

    const views = await listEvents.execute({ actor: ANA, groupId: 1 })

    expect(views.map((v) => [v.event.name, v.isFinished])).toEqual([
      ['Show em Manaus', false],
      ['Show em Lisboa', true],
    ])

    // 00:00 of the 17th in Manaus.
    clock.set(new Date('2026-11-17T04:00:00.000Z'))
    const later = await listEvents.execute({ actor: ANA, groupId: 1 })
    expect(later.map((v) => v.isFinished)).toEqual([true, true])
  })

  it('lets the Super admin list the Events of any Group', async () => {
    await arrange(1, 'Show em Manaus')

    expect(await listEvents.execute({ actor: SUPER_ADMIN, groupId: 1 })).toHaveLength(1)
  })

  it('answers NOT_FOUND to who is not a Group member, and for a Group that does not exist', async () => {
    await expect(listEvents.execute({ actor: ANA, groupId: 1 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(listEvents.execute({ actor: SUPER_ADMIN, groupId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
