import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemAudience } from '../../domain/event-item-audience.vo.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryChangeRepository } from '../testing/in-memory-change.repository.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { InMemoryParticipantRepository } from '../testing/in-memory-participant.repository.js'
import { RemoveParticipantUseCase } from './remove-participant.use-case.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')
const BIA = 3
const DUDA = 4

describe('RemoveParticipantUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let items: InMemoryEventItemRepository
  let participants: InMemoryParticipantRepository
  let changes: InMemoryChangeRepository
  let unitOfWork: InMemoryUnitOfWork
  let removeParticipant: RemoveParticipantUseCase
  let eventId: number

  beforeEach(async () => {
    // The Vocal Livre: Ana is an Owner, Bia and Duda are Viewers; Ana and Bia go, Duda does not.
    directory = new FakeGroupDirectory()
      .addMember(1, ANA.id, 'OWNER')
      .addMember(1, BIA, 'VIEWER')
      .addMember(1, DUDA, 'VIEWER')
      .addMember(2, 99, 'OWNER')
    events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    participants = new InMemoryParticipantRepository(events)
    changes = new InMemoryChangeRepository()
    unitOfWork = new InMemoryUnitOfWork()
    removeParticipant = new RemoveParticipantUseCase({
      directory,
      events,
      items,
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
    await participants.create(eventId, [ANA.id, BIA], { by: null, at: CREATED_AT })
  })

  it('lets an Owner take a Participant off the list', async () => {
    await removeParticipant.execute({ actor: ANA, eventId, userId: BIA })

    expect(await participants.findByEvent(eventId)).toEqual([ANA.id])
  })

  it('records the exit as a Change only the production sees, reaching every Group member, in one unit of work', async () => {
    await removeParticipant.execute({ actor: ANA, eventId, userId: BIA })

    expect(changes.ofEvent(eventId)).toEqual([
      {
        id: expect.any(Number),
        eventId,
        eventItemId: null,
        attribute: 'participant',
        before: BIA,
        after: null,
        productionOnly: true,
        reachBefore: [ANA.id, BIA, DUDA],
        reachAfter: [ANA.id, BIA, DUDA],
        by: ANA.id,
        at: NOW,
      },
    ])
    expect(unitOfWork.runs()).toBe(1)
  })

  it('takes who leaves off the Audiences chosen of the Event, keeping the others and "Todos" as they are', async () => {
    await participants.create(eventId, [DUDA], { by: null, at: CREATED_AT })
    const [both, onlyBia, all] = await Promise.all(
      ['Van 1', 'Van 2', 'Show'].map((name, i) =>
        items.create(
          {
            eventId,
            name: EventItemName.create(name),
            start: EventItemStart.create({ date: null, time: null }),
            place: null,
            state: 'PUBLISHED',
            position: i + 1,
          },
          { by: null, at: CREATED_AT },
        ),
      ),
    )
    both!.edit(
      { audience: EventItemAudience.selected([BIA, DUDA]) },
      { by: ANA.id, at: CREATED_AT },
    )
    onlyBia!.edit({ audience: EventItemAudience.selected([BIA]) }, { by: ANA.id, at: CREATED_AT })
    await items.save(both!)
    await items.save(onlyBia!)

    await removeParticipant.execute({ actor: ANA, eventId, userId: BIA })

    expect(items.ofEvent(eventId).map((i) => i.audience.toValues())).toEqual([
      { kind: 'SELECTED', userIds: [DUDA] },
      { kind: 'SELECTED', userIds: [] },
      { kind: 'ALL' },
    ])
    expect(all!.audience.kind).toBe('ALL')
    expect(unitOfWork.runs()).toBe(1)
  })

  it('lets the Super admin take an Owner off the list', async () => {
    await removeParticipant.execute({ actor: SUPER_ADMIN, eventId, userId: ANA.id })

    expect(await participants.findByEvent(eventId)).toEqual([BIA])
    expect(changes.ofEvent(eventId)[0]?.by).toBe(SUPER_ADMIN.id)
  })

  it('takes off a Participant who is no longer a Group member', async () => {
    await participants.create(eventId, [77], { by: null, at: CREATED_AT })

    await removeParticipant.execute({ actor: ANA, eventId, userId: 77 })

    expect(await participants.findByEvent(eventId)).toEqual([ANA.id, BIA])
  })

  it('refuses who is not a Participant with NOT_FOUND, writing nothing', async () => {
    await expect(removeParticipant.execute({ actor: ANA, eventId, userId: DUDA })).rejects.toThrow(
      new AppError('NOT_FOUND'),
    )
    expect(changes.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Cancelled Event with EVENT_CANCELLED', async () => {
    const event = await events.findById(eventId)
    event!.cancel({ by: ANA.id, at: CREATED_AT })
    await events.save(event!)

    await expect(removeParticipant.execute({ actor: ANA, eventId, userId: BIA })).rejects.toThrow(
      new AppError('EVENT_CANCELLED'),
    )
    expect(await participants.findByEvent(eventId)).toEqual([ANA.id, BIA])
  })

  it('refuses a Viewer with FORBIDDEN, even taking themself off', async () => {
    await expect(
      removeParticipant.execute({ actor: { id: BIA, isSuperAdmin: false }, eventId, userId: BIA }),
    ).rejects.toThrow(new AppError('FORBIDDEN'))
  })

  it('refuses who is not a Group member, and an Event that does not exist, with NOT_FOUND', async () => {
    await expect(
      removeParticipant.execute({ actor: { id: 99, isSuperAdmin: false }, eventId, userId: BIA }),
    ).rejects.toThrow(new AppError('NOT_FOUND'))
    await expect(
      removeParticipant.execute({ actor: ANA, eventId: eventId + 1, userId: BIA }),
    ).rejects.toThrow(new AppError('NOT_FOUND'))
  })
})
