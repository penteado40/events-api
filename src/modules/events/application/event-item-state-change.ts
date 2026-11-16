import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { eventItemChanges } from '../domain/event-item-changes.js'
import { peopleInFields } from '../domain/field.entity.js'
import type { EventItem } from '../domain/event-item.entity.js'
import type { EventItemWriteDeps } from './event-item-write-deps.js'
import { lockEventItem } from './event-item-lock.js'
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
    // Under the item's lock, of two moves that race, the second sees the first's state.
    const { item, fields, reach } = await lockEventItem(deps, {
      groupId: event.groupId,
      eventId: event.id,
      itemId: target.itemId,
    })
    const before = item.snapshot()
    move(item, stamp)
    await deps.items.save(item)
    await deps.changeLog.create(
      event.id,
      eventItemChanges(before, item.snapshot(), reach, peopleInFields(fields)),
      stamp,
    )
    return itemViewOf(item, event.period.timezone.value)
  })
}
