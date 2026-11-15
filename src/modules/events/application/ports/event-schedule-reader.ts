import type { EventItemSnapshot } from '../../domain/event-item.entity.js'
import type { CancellableEventState, EventState } from '../../domain/event.entity.js'

/** An Event loaded whole as plain data, for reading its schedule (ADR-0019). */
export interface EventScheduleData {
  eventId: number
  groupId: number
  /** The Event's default zone, for the items whose place has none. */
  timezone: string
  state: EventState
  /** The state before the cancel, while Cancelled; null otherwise. */
  cancelledFrom: CancellableEventState | null
  /** The User ids of the Participants of the Event. */
  participants: number[]
  /** Every Event item of the Event, with its manual position; the assembly orders them. */
  items: EventItemSnapshot[]
}

/**
 * The read port of the schedule (docs/arquitetura.md, Port de leitura): loads
 * one Event with all its Event items and its Participants as plain data, never hydrating entities.
 * Who sees what is decided in memory, never in the query.
 */
export abstract class EventScheduleReader {
  /** null when the Event does not exist. */
  abstract load(eventId: number): Promise<EventScheduleData | null>
}
