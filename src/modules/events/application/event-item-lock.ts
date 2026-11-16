import { AppError } from '../../../shared/domain/app-error.js'
import type { ItemReachContext } from '../domain/event-item-reach.js'
import type { EventItem } from '../domain/event-item.entity.js'
import type { Event } from '../domain/event.entity.js'
import type { EventItemWriteDeps } from './event-item-write-deps.js'
import { itemReachContext } from './item-reach-context.js'

/** An Event item held for a write, with its Event and what the reach rule weighs. */
export interface LockedEventItem {
  /** The Event, under its lock, writable. */
  event: Event
  /** The item, under its lock: as the last write left it. */
  item: EventItem
  reach: ItemReachContext
}

/**
 * Holds what a write of one Event item, or of its Fields, works on, inside
 * the caller's unit of work. Locks go Group, Event, item, always: the roster
 * is held until commit (ADR-0014), so the reach is the one that stands when
 * the Changes land, and the Participants are held with the Event. Under the
 * Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED;
 * under the item's, a delete that came first leaves NOT_FOUND. Whether a
 * Cancelled item takes the write is the caller's to say (uncancel does).
 */
export async function lockEventItem(
  deps: EventItemWriteDeps,
  target: { groupId: number; eventId: number; itemId: number },
): Promise<LockedEventItem> {
  const members = await deps.directory.lockMembers(target.groupId)
  const frozen = await deps.events.lockById(target.eventId)
  if (!frozen) throw new AppError('NOT_FOUND')
  frozen.assertWritable()
  const reach = await itemReachContext(frozen, members, deps.participants)
  const item = await deps.items.lockInEvent(target.eventId, target.itemId)
  if (!item) throw new AppError('NOT_FOUND')
  return { event: frozen, item, reach }
}
