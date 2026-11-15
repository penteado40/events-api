import { AppError } from '../../../shared/domain/app-error.js'
import type { ItemReachContext } from '../domain/event-item-reach.js'
import type { EventItem } from '../domain/event-item.entity.js'
import type { ActingUser } from './actor.js'
import { requireEventsEditor } from './event-access.js'
import type { EventItemWriteDeps } from './event-item-write-deps.js'
import { itemReachContext } from './item-reach-context.js'

/** What a write of a Field works on: its Event item, held, and what the reach rule weighs. */
export interface FieldWriteContext {
  item: EventItem
  reach: ItemReachContext
}

/**
 * Runs a write of the Fields of an Event item, by an Owner of its Group or
 * the Super admin, in one unit of work. The role is checked before the state:
 * a Viewer is FORBIDDEN, never a 409. A Field is part of its item, so a
 * Cancelled Event (EVENT_CANCELLED) or a Cancelled item (EVENT_ITEM_CANCELLED)
 * freezes it, the order of the Fields included. Locks go Group, Event, item,
 * always (see EditEventItemUseCase); the Fields are read under the item's
 * lock, which every write of them takes, so they are the ones that stand.
 */
export async function writeFieldsOf<T>(
  deps: EventItemWriteDeps,
  actor: ActingUser,
  target: { eventId: number; itemId: number },
  write: (context: FieldWriteContext) => Promise<T>,
): Promise<T> {
  const event = await deps.events.findById(target.eventId)
  if (!event) throw new AppError('NOT_FOUND')
  await requireEventsEditor(actor, event.groupId, deps.directory)

  return deps.unitOfWork.run(async () => {
    const members = await deps.directory.lockMembers(event.groupId)
    // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
    const frozen = await deps.events.lockById(event.id)
    if (!frozen) throw new AppError('NOT_FOUND')
    frozen.assertWritable()
    const reach = await itemReachContext(frozen, members, deps.participants)
    // Under the item's lock, a delete that came first leaves NOT_FOUND, a cancel, EVENT_ITEM_CANCELLED.
    const item = await deps.items.lockInEvent(event.id, target.itemId)
    if (!item) throw new AppError('NOT_FOUND')
    item.assertWritable()
    return write({ item, reach })
  })
}
