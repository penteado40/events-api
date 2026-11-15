import { beforeEach, describe, expect, it } from 'vitest'
import { EventName } from '../domain/event-name.vo.js'
import { EventPeriod } from '../domain/event-period.vo.js'
import { EventPlace } from '../domain/event-place.vo.js'
import { ParticipationLookup } from './participation-lookup.js'
import { ANA, MANAUS_PERIOD } from './testing/events-fixtures.js'
import { InMemoryEventRepository } from './testing/in-memory-event.repository.js'
import { InMemoryParticipantRepository } from './testing/in-memory-participant.repository.js'

const STAMP = { by: null, at: new Date('2026-10-01T12:00:00.000Z') }

describe('ParticipationLookup', () => {
  let events: InMemoryEventRepository
  let participants: InMemoryParticipantRepository
  let lookup: ParticipationLookup

  beforeEach(() => {
    events = new InMemoryEventRepository()
    participants = new InMemoryParticipantRepository(events)
    lookup = new ParticipationLookup(participants)
  })

  async function anEvent(groupId: number): Promise<number> {
    const event = await events.create(
      {
        groupId,
        name: EventName.create('Show'),
        place: EventPlace.create('Manaus'),
        period: EventPeriod.create(MANAUS_PERIOD),
      },
      STAMP,
    )
    return event.id
  }

  it('gives the Events the User is a Participant of, with their Group, in the order they were created', async () => {
    const first = await anEvent(1)
    const other = await anEvent(2)
    const notHers = await anEvent(1)
    const last = await anEvent(1)
    await participants.create(last, [ANA.id], STAMP)
    await participants.create(other, [ANA.id, 7], STAMP)
    await participants.create(notHers, [7], STAMP)
    await participants.create(first, [ANA.id], STAMP)

    expect(await lookup.ofUser(ANA.id)).toEqual([
      { groupId: 1, eventId: first },
      { groupId: 2, eventId: other },
      { groupId: 1, eventId: last },
    ])
    expect(await lookup.ofUser(42)).toEqual([])
  })
})
