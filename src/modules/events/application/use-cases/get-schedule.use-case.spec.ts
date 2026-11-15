import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { positionAfter } from '../../domain/event-item-order.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { FieldName } from '../../domain/field.entity.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventScheduleReader } from '../testing/in-memory-event-schedule-reader.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { InMemoryFieldRepository } from '../testing/in-memory-field.repository.js'
import { InMemoryParticipantRepository } from '../testing/in-memory-participant.repository.js'
import { type GetScheduleOutput, GetScheduleUseCase } from './get-schedule.use-case.js'

const AT = new Date('2026-10-01T12:00:00.000Z')

describe('GetScheduleUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let participants: InMemoryParticipantRepository
  let fields: InMemoryFieldRepository
  let getSchedule: GetScheduleUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    participants = new InMemoryParticipantRepository(events)
    fields = new InMemoryFieldRepository(items)
    getSchedule = new GetScheduleUseCase(
      directory,
      new InMemoryEventScheduleReader(events, items, participants, fields),
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
    for (const [name, date, time, state] of [
      ['O que levar', null, null, 'PUBLISHED'],
      ['Show', '2026-11-14', '19:00', 'PUBLISHED'],
      ['Bis', '2026-11-14', '22:00', 'DRAFT'],
      ['Passeio de barco', '2026-11-15', '09:00', 'CANCELLED'],
    ] as const) {
      await items.create(
        {
          eventId,
          name: EventItemName.create(name),
          start: EventItemStart.create({ date, time }),
          place: null,
          position: positionAfter(items.ofEvent(eventId)),
          state,
        },
        { by: null, at: AT },
      )
    }
  })

  async function publishEvent(): Promise<void> {
    const event = await events.findById(eventId)
    event!.publish({ by: null, at: AT })
    await events.save(event!)
  }

  /** The names of the items of the schedule, General info first, then the Timeline day by day. */
  function namesIn(schedule: GetScheduleOutput): string[] {
    return [
      ...schedule.generalInfo.map((i) => i.name),
      ...schedule.timeline.flatMap((day) => day.items.map((i) => i.name)),
    ]
  }

  it('gives an Owner the General info and the Timeline of the Event, Draft and Cancelled included', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const schedule = await getSchedule.execute({ actor: ANA, eventId })

    expect(schedule.generalInfo).toEqual([
      { id: 1, name: 'O que levar', when: null, place: null, state: 'PUBLISHED', fields: [] },
    ])
    expect(schedule.timeline[0]).toEqual({
      date: '2026-11-14',
      items: [
        {
          id: 2,
          name: 'Show',
          when: { date: '2026-11-14', time: '19:00', timezone: 'America/Manaus' },
          place: null,
          state: 'PUBLISHED',
          fields: [],
        },
        {
          id: 3,
          name: 'Bis',
          when: { date: '2026-11-14', time: '22:00', timezone: 'America/Manaus' },
          place: null,
          state: 'DRAFT',
          fields: [],
        },
      ],
    })
    expect(namesIn(schedule)).toEqual(['O que levar', 'Show', 'Bis', 'Passeio de barco'])
  })

  it('gives the Super admin the whole schedule', async () => {
    const schedule = await getSchedule.execute({ actor: SUPER_ADMIN, eventId })

    expect(namesIn(schedule)).toEqual(['O que levar', 'Show', 'Bis', 'Passeio de barco'])
  })

  it('gives a Viewer Participant of a published Event only the published and the Cancelled items', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    await participants.create(eventId, [ANA.id], { by: null, at: AT })
    await publishEvent()

    const schedule = await getSchedule.execute({ actor: ANA, eventId })

    expect(namesIn(schedule)).toEqual(['O que levar', 'Show', 'Passeio de barco'])
    expect(schedule.timeline.map((day) => day.date)).toEqual(['2026-11-14', '2026-11-15'])
    expect(schedule.timeline[1]?.items[0]?.state).toBe('CANCELLED')
  })

  it('brings the Fields of each item in the order of the production, to the Owner and to the Viewer it reaches', async () => {
    directory.addMember(1, ANA.id, 'VIEWER').addMember(1, 3, 'OWNER')
    await participants.create(eventId, [ANA.id], { by: null, at: AT })
    await publishEvent()
    for (const [name, text, position] of [
      ['Obs', 'despachar som', 2],
      ['Voo', 'G3 1234', 1],
    ] as const) {
      await fields.create(
        { eventItemId: 2, name: FieldName.create(name), value: { kind: 'TEXT', text }, position },
        { by: null, at: AT },
      )
    }
    const fieldsOfTheShow = [
      { id: 2, kind: 'TEXT', name: 'Voo', value: 'G3 1234' },
      { id: 1, kind: 'TEXT', name: 'Obs', value: 'despachar som' },
    ]

    for (const actor of [ANA, { id: 3, isSuperAdmin: false }]) {
      const schedule = await getSchedule.execute({ actor, eventId })
      expect(schedule.timeline[0]?.items[0]?.fields).toEqual(fieldsOfTheShow)
      expect(schedule.generalInfo[0]?.fields).toEqual([])
    }
  })

  it('gives a Viewer Participant of an Event in Draft an empty schedule', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    await participants.create(eventId, [ANA.id], { by: null, at: AT })

    expect(await getSchedule.execute({ actor: ANA, eventId })).toEqual({
      generalInfo: [],
      timeline: [],
    })
  })

  it('gives a Viewer who is not a Participant an empty schedule, even of a published Event', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')
    await participants.create(eventId, [42], { by: null, at: AT })
    await publishEvent()

    expect(await getSchedule.execute({ actor: ANA, eventId })).toEqual({
      generalInfo: [],
      timeline: [],
    })
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
