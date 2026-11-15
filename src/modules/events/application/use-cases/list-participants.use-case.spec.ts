import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { FakeUserDirectory } from '../testing/fake-user-directory.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { InMemoryParticipantRepository } from '../testing/in-memory-participant.repository.js'
import { ListParticipantsUseCase } from './list-participants.use-case.js'

const STAMP = { by: null, at: new Date('2026-10-01T12:00:00.000Z') }
const BIA = { id: 7, name: 'Bia', phone: '+5592999990007' }
const CAIO = { id: 8, name: 'Caio', phone: '+5592999990008' }

describe('ListParticipantsUseCase', () => {
  let directory: FakeGroupDirectory
  let participants: InMemoryParticipantRepository
  let listParticipants: ListParticipantsUseCase
  let eventId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    const events = new InMemoryEventRepository()
    participants = new InMemoryParticipantRepository()
    const users = new FakeUserDirectory()
      .add({ id: ANA.id, name: 'Ana', phone: '+5592999990002' })
      .add(BIA)
      .add(CAIO)
    listParticipants = new ListParticipantsUseCase(directory, events, participants, users)
    const event = await events.create(
      {
        groupId: 1,
        name: EventName.create('Show em Manaus'),
        place: EventPlace.create('Manaus'),
        period: EventPeriod.create(MANAUS_PERIOD),
      },
      STAMP,
    )
    eventId = event.id
  })

  it('shows a Viewer who is not a Participant the name, phone and role of each Participant, in the order of the list', async () => {
    directory.addMember(1, CAIO.id, 'OWNER').addMember(1, BIA.id, 'VIEWER')
    directory.addMember(1, ANA.id, 'VIEWER')
    await participants.create(eventId, [BIA.id, CAIO.id], STAMP)

    expect(await listParticipants.execute({ actor: ANA, eventId })).toEqual([
      { userId: BIA.id, name: 'Bia', phone: '+5592999990007', role: 'VIEWER' },
      { userId: CAIO.id, name: 'Caio', phone: '+5592999990008', role: 'OWNER' },
    ])
  })

  it('gives the role of now, and null to a Participant who is no longer a Group member', async () => {
    directory.addMember(1, BIA.id, 'OWNER')
    await participants.create(eventId, [BIA.id, CAIO.id], STAMP)

    expect(await listParticipants.execute({ actor: SUPER_ADMIN, eventId })).toEqual([
      { userId: BIA.id, name: 'Bia', phone: '+5592999990007', role: 'OWNER' },
      { userId: CAIO.id, name: 'Caio', phone: '+5592999990008', role: null },
    ])
  })

  it('answers NOT_FOUND to who is not a Group member of its Group, and for an Event that does not exist', async () => {
    directory.addMember(2, ANA.id, 'OWNER')

    await expect(listParticipants.execute({ actor: ANA, eventId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(listParticipants.execute({ actor: SUPER_ADMIN, eventId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
