import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EventItem, NewEventItemProps } from './event-item.entity.js'
import type { EventItemPosition } from './event-item-order.js'

/** The Event items, for the writes. The schedule is read through its own port (ADR-0019). */
export abstract class EventItemRepository {
  /** The Event item of that Event; null when it does not exist or is another Event's. */
  abstract findInEvent(eventId: number, itemId: number): Promise<EventItem | null>
  /**
   * As findInEvent, holding the item's row until the unit of work ends: a
   * write that waited on another finds the item as that one left it, or gone.
   */
  abstract lockInEvent(eventId: number, itemId: number): Promise<EventItem | null>
  /**
   * Every Event item of the Event. Read under the Event's lock, it is the set
   * every other write of the Event's items waits on.
   */
  abstract findAllInEvent(eventId: number): Promise<EventItem[]>
  /**
   * In an Event in Draft, a new Event item is born published, last in the
   * order of the production: after every item of the Event, so last in its
   * tie group. Called under the Event's lock, so two creations never share it.
   */
  abstract create(props: NewEventItemProps, stamp: Stamp): Promise<EventItem>
  /** Writes the new manual positions of a reorder; the items keep their Author (the Change has it). */
  abstract reposition(positions: readonly EventItemPosition[]): Promise<void>
  abstract save(item: EventItem): Promise<void>
  abstract delete(itemId: number): Promise<void>
}
