import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EventItem, NewEventItemProps } from './event-item.entity.js'

/** The Event items, for the writes. The schedule is read through its own port (ADR-0019). */
export abstract class EventItemRepository {
  /** The Event item of that Event; null when it does not exist or is another Event's. */
  abstract findInEvent(eventId: number, itemId: number): Promise<EventItem | null>
  /** In an Event in Draft, a new Event item is born published. */
  abstract create(props: NewEventItemProps, stamp: Stamp): Promise<EventItem>
  abstract save(item: EventItem): Promise<void>
  abstract delete(itemId: number): Promise<void>
}
