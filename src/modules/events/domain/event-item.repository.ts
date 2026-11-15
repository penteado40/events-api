import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EventItem, NewEventItemProps } from './event-item.entity.js'

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
  /** A new Event item, in the state and at the position it is given. */
  abstract create(props: NewEventItemProps, stamp: Stamp): Promise<EventItem>
  /** Writes the item as it is, its Audience included: the people chosen are replaced at once. */
  abstract save(item: EventItem): Promise<void>
  abstract delete(itemId: number): Promise<void>
  /**
   * Takes the User off the Audiences chosen of every Event item of the Event
   * (CONTEXT.md, Participant: who leaves the Participants leaves the
   * Audiences). An Audience "Todos" follows the list by itself; an item
   * whose list is left empty keeps the Audience chosen, reaching no one else.
   */
  abstract removeFromAudiences(eventId: number, userId: number): Promise<void>
}
