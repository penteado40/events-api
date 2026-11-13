import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventScheduleReader } from '../testing/in-memory-event-schedule-reader.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { GetScheduleUseCase } from './get-schedule.use-case.js'

const AT = new Date('2026-10-01T12:00:00.000Z')

describe('GetScheduleUseCase', () => {
  let directory: FakeGroupDirectory
  let getSchedule: GetScheduleUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    const events = new InMemoryEventRepository()
    const items = new InMemoryEventItemRepository()
    getSchedule = new GetScheduleUseCase(directory, new InMemoryEventScheduleReader(events, items))
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
    for (const [name, date, time] of [
      ['O que levar', null, null],
      ['Show', '2026-11-14', '19:00'],
    ] as const) {
      await items.create(
        {
          eventId,
          name: EventItemName.create(name),
          start: EventItemStart.create({ date, time }),
          place: null,
        },
        { by: null, at: AT },
      )
    }
  })

  it('gives an Owner the General info and the Timeline of the Event', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const schedule = await getSchedule.execute({ actor: ANA, eventId })

    expect(schedule).toEqual({
      generalInfo: [{ id: 1, name: 'O que levar', when: null, place: null, state: 'PUBLISHED' }],
      timeline: [
        {
          date: '2026-11-14',
          items: [
            {
              id: 2,
              name: 'Show',
              when: { date: '2026-11-14', time: '19:00', timezone: 'America/Manaus' },
              place: null,
              state: 'PUBLISHED',
            },
          ],
        },
      ],
    })
  })

  it('gives the Super admin the schedule', async () => {
    const schedule = await getSchedule.execute({ actor: SUPER_ADMIN, eventId })

    expect(schedule.generalInfo).toHaveLength(1)
  })

  it('refuses a Viewer with FORBIDDEN, until the reach rule lets them read their own', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(getSchedule.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND to who is not a Group member, and for an Event that does not exist', async () => {
    await expect(getSchedule.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(getSchedule.execute({ actor: SUPER_ADMIN, eventId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
