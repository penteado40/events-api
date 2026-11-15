import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { eventItemChanges } from '../domain/event-item-changes.js'
import type { EventItem } from '../domain/event-item.entity.js'
import type { EventItemWriteDeps } from './event-item-write-deps.js'
import { itemReachContext } from './item-reach-context.js'
import type { ActingUser } from './actor.js'
import { requireEventsEditor } from './event-access.js'
import { type EventItemView, itemViewOf } from './event-item-view.js'

/**
 * Moves an Event item to another state (publish, cancel, uncancel), by an
 * Owner of its Group or the Super admin. A Cancelled Event is frozen:
 * EVENT_CANCELLED, checked under the Event's lock. The move is a Change of the
 * state of the item, written in the same unit of work (amendment of ADR-0010),
 * with the reach of before and of after from the reach rule over the Event,
 * its Participants and the Group members read under the Group's lock. The role is checked before the state:
 * a Viewer is FORBIDDEN, never a 409. The stamp is the use case's, so the
 * clock of the deps is not read here.
 */
export async function changeEventItemState(
  deps: EventItemWriteDeps,
  actor: ActingUser,
  target: { eventId: number; itemId: number },
  stamp: Stamp,
  move: (item: EventItem, stamp: Stamp) => void,
): Promise<EventItemView> {
  const event = await deps.events.findById(target.eventId)
  if (!event) throw new AppError('NOT_FOUND')
  await requireEventsEditor(actor, event.groupId, deps.directory)

  return deps.unitOfWork.run(async () => {
    // Locks go Group, Event, item, always (see EditEventItemUseCase).
    const members = await deps.directory.lockMembers(event.groupId)
    // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
    const frozen = await deps.events.lockById(event.id)
    if (!frozen) throw new AppError('NOT_FOUND')
    frozen.assertWritable()
    // Under the lock, of two moves that race, the second sees the first's state; a delete leaves NOT_FOUND.
    const item = await deps.items.lockInEvent(event.id, target.itemId)
    if (!item) throw new AppError('NOT_FOUND')
    const reach = await itemReachContext(frozen, members, deps.participants)
    const before = item.snapshot()
    move(item, stamp)
    await deps.items.save(item)
    await deps.changeLog.create(event.id, eventItemChanges(before, item.snapshot(), reach), stamp)
    return itemViewOf(item, event.period.timezone.value)
  })
}
