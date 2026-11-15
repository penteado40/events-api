import type { Clock } from '../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js'
import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { NewChange } from '../domain/change.js'
import type { ChangeRepository } from '../domain/change.repository.js'
import type { GroupMemberRole } from '../domain/event-access-policy.js'
import { eventReach } from '../domain/event-reach.js'
import type { EventRepository } from '../domain/event.repository.js'
import type { ParticipantRepository } from '../domain/participant.repository.js'
import type { ActingUser } from './actor.js'
import { requireEventsEditor } from './event-access.js'
import type { GroupDirectory } from './ports/group-directory.js'

/**
 * What every adjustment of the list of Participants (add, remove) works with.
 * One bundle, so a new collaborator of these writes is added here and in its
 * one provider in the module. An abstract class, so it is its own injection token.
 */
export abstract class ParticipantWriteDeps {
  abstract readonly directory: GroupDirectory
  abstract readonly events: EventRepository
  abstract readonly participants: ParticipantRepository
  abstract readonly changeLog: ChangeRepository
  abstract readonly unitOfWork: UnitOfWork
  abstract readonly clock: Clock
}

/** Where a step on the list of Participants stands, under the locks. */
export interface ParticipantStepContext {
  eventId: number
  /** The Group members, read under the Group's lock. */
  members: readonly GroupMemberRole[]
  /** Whom the step's Change reaches: every Group member (eventReach). */
  reach: readonly number[]
  stamp: Stamp
}

/** One step on the list: it writes the list and gives back its Change, or null when nothing changed. */
export type ParticipantStep = (context: ParticipantStepContext) => Promise<NewChange | null>

/**
 * Adjusts the list of Participants of an Event, by an Owner of its Group or
 * the Super admin. The role is checked before the state: a Viewer is
 * FORBIDDEN, never a 409. A Cancelled Event is frozen: EVENT_CANCELLED.
 *
 * The step runs in one unit of work with its Change (amendment of ADR-0010),
 * under the Group's roster and the Event held until commit (ADR-0014; locks go
 * Group, then Event, always): a Viewer removed from the Group meanwhile is not
 * added, two steps on the same Event go one after the other, and the writes of
 * the Event's items, which read the Participants under the same locks, see the
 * list before or after, never half of it.
 */
export async function changeParticipants(
  deps: ParticipantWriteDeps,
  actor: ActingUser,
  eventId: number,
  step: ParticipantStep,
): Promise<void> {
  const found = await deps.events.findById(eventId)
  if (!found) throw new AppError('NOT_FOUND')
  await requireEventsEditor(actor, found.groupId, deps.directory)
  const stamp = { by: actor.id, at: deps.clock.now() }

  await deps.unitOfWork.run(async () => {
    const members = await deps.directory.lockMembers(found.groupId)
    const event = await deps.events.lockById(eventId)
    if (!event) throw new AppError('NOT_FOUND')
    event.assertWritable()
    const change = await step({ eventId: event.id, members, reach: eventReach(members), stamp })
    if (change) await deps.changeLog.create(event.id, [change], stamp)
  })
}
