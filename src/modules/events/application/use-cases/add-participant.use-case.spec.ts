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
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { InMemoryParticipantRepository } from '../testing/in-memory-participant.repository.js'
import { AddParticipantUseCase } from './add-participant.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')
const BIA = 3
const DUDA = 4

describe('AddParticipantUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let participants: InMemoryParticipantRepository
  let changes: InMemoryChangeRepository
  let unitOfWork: InMemoryUnitOfWork
  let addParticipant: AddParticipantUseCase
  let eventId: number

  beforeEach(async () => {
    // The Vocal Livre: Ana is an Owner, Bia and Duda are Viewers; only Ana goes for now.
    directory = new FakeGroupDirectory()
      .addMember(1, ANA.id, 'OWNER')
      .addMember(1, BIA, 'VIEWER')
      .addMember(1, DUDA, 'VIEWER')
      .addMember(2, 99, 'OWNER')
    events = new InMemoryEventRepository()
    participants = new InMemoryParticipantRepository(events)
    changes = new InMemoryChangeRepository()
    unitOfWork = new InMemoryUnitOfWork()
    addParticipant = new AddParticipantUseCase({
      directory,
      events,
      items: new InMemoryEventItemRepository(),
      participants,
      changeLog: changes,
      unitOfWork,
      clock: new FixedClock(NOW),
    })
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
    await participants.create(eventId, [ANA.id], { by: null, at: CREATED_AT })
  })

  it('lets an Owner add a Group member to the Participants, as the Author', async () => {
    await addParticipant.execute({ actor: ANA, eventId, userId: BIA })

    expect(await participants.findByEvent(eventId)).toEqual([ANA.id, BIA])
    expect(participants.stampsOf(eventId)[1]).toEqual({ by: ANA.id, at: NOW })
  })

  it('records the entry as a Change only the production sees, reaching every Group member, in one unit of work', async () => {
    await addParticipant.execute({ actor: ANA, eventId, userId: BIA })

    expect(changes.ofEvent(eventId)).toEqual([
      {
        id: expect.any(Number),
        eventId,
        eventItemId: null,
        attribute: 'participant',
        before: null,
        after: BIA,
        productionOnly: true,
        reachBefore: [ANA.id, BIA, DUDA],
        reachAfter: [ANA.id, BIA, DUDA],
        by: ANA.id,
        at: NOW,
      },
    ])
    expect(unitOfWork.runs()).toBe(1)
  })

  it('changes nothing when the User is already a Participant', async () => {
    await addParticipant.execute({ actor: ANA, eventId, userId: BIA })

    await addParticipant.execute({ actor: ANA, eventId, userId: BIA })

    expect(await participants.findByEvent(eventId)).toEqual([ANA.id, BIA])
    expect(changes.ofEvent(eventId)).toHaveLength(1)
  })

  it('lets the Super admin add a Participant', async () => {
    await addParticipant.execute({ actor: SUPER_ADMIN, eventId, userId: DUDA })

    expect(await participants.findByEvent(eventId)).toEqual([ANA.id, DUDA])
    expect(changes.ofEvent(eventId)[0]?.by).toBe(SUPER_ADMIN.id)
  })

  it('refuses who is not a Group member of the Group of the Event with NOT_FOUND', async () => {
    await expect(addParticipant.execute({ actor: ANA, eventId, userId: 99 })).rejects.toThrow(
      new AppError('NOT_FOUND'),
    )
    expect(await participants.findByEvent(eventId)).toEqual([ANA.id])
    expect(changes.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Cancelled Event with EVENT_CANCELLED', async () => {
    const event = await events.findById(eventId)
    event!.cancel({ by: ANA.id, at: CREATED_AT })
    await events.save(event!)

    await expect(addParticipant.execute({ actor: ANA, eventId, userId: BIA })).rejects.toThrow(
      new AppError('EVENT_CANCELLED'),
    )
    expect(await participants.findByEvent(eventId)).toEqual([ANA.id])
  })

  it('refuses a Viewer with FORBIDDEN, even on a Cancelled Event', async () => {
    const event = await events.findById(eventId)
    event!.cancel({ by: ANA.id, at: CREATED_AT })
    await events.save(event!)

    await expect(
      addParticipant.execute({ actor: { id: BIA, isSuperAdmin: false }, eventId, userId: DUDA }),
    ).rejects.toThrow(new AppError('FORBIDDEN'))
  })

  it('refuses who is not a Group member, and an Event that does not exist, with NOT_FOUND', async () => {
    await expect(
      addParticipant.execute({ actor: { id: 99, isSuperAdmin: false }, eventId, userId: BIA }),
    ).rejects.toThrow(new AppError('NOT_FOUND'))
    await expect(
      addParticipant.execute({ actor: ANA, eventId: eventId + 1, userId: BIA }),
    ).rejects.toThrow(new AppError('NOT_FOUND'))
  })
})
