import type { UnitOfWork } from '../../../shared/application/unit-of-work.js'
import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ChangeRepository } from '../domain/change.repository.js'
import { eventChanges } from '../domain/event-changes.js'
import type { Event } from '../domain/event.entity.js'
import type { EventRepository } from '../domain/event.repository.js'
import type { ActingUser } from './actor.js'
import { requireEventsEditor } from './event-access.js'
import { type EventView, viewOf } from './event-view.js'
import type { GroupDirectory } from './ports/group-directory.js'

export interface EventStateChangeDeps {
  directory: GroupDirectory
  events: EventRepository
  changeLog: ChangeRepository
  unitOfWork: UnitOfWork
}

/**
 * Moves an Event to another state (publish, cancel, uncancel), by an Owner of
 * its Group or the Super admin. The move is a Change of the state, written in
 * the same unit of work as the Event (amendment of ADR-0010), with the reach of
 * every Group member read under the Group's lock, like the edit of the Event.
 * The role is checked before the state: a Viewer is FORBIDDEN, never a 409.
 * The stamp is the use case's: its Author and the instant of its Clock.
 */
export async function changeEventState(
  deps: EventStateChangeDeps,
  actor: ActingUser,
  eventId: number,
  stamp: Stamp,
  move: (event: Event, stamp: Stamp) => void,
): Promise<EventView> {
  const found = await deps.events.findById(eventId)
  if (!found) throw new AppError('NOT_FOUND')
  const { groupId } = found
  await requireEventsEditor(actor, groupId, deps.directory)

  return deps.unitOfWork.run(async () => {
    // Locks go Group, then Event, always (see EditEventUseCase).
    const reach = await deps.directory.lockMemberIds(groupId)
    // Re-read under the lock: of two moves that race, the second sees the first's state.
    const event = await deps.events.lockById(eventId)
    if (!event) throw new AppError('NOT_FOUND')
    const before = event.snapshot(reach)
    move(event, stamp)
    await deps.events.save(event)
    await deps.changeLog.create(event.id, eventChanges(before, event.snapshot(reach)), stamp)
    return viewOf(event, stamp.at)
  })
}
