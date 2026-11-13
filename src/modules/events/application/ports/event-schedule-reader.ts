import type { EventItemSnapshot } from '../../domain/event-item.entity.js'

/** An Event loaded whole as plain data, for reading its schedule (ADR-0019). */
export interface EventScheduleData {
  eventId: number
  groupId: number
  /** The Event's default zone, for the items whose place has none. */
  timezone: string
  /** Every Event item of the Event, in the order of the production (for now, of creation). */
  items: EventItemSnapshot[]
}

/**
 * The read port of the schedule (docs/arquitetura.md, Port de leitura): loads
 * one Event with all its Event items as plain data, never hydrating entities.
 * Who sees what is decided in memory, never in the query.
 */
export abstract class EventScheduleReader {
  /** null when the Event does not exist. */
  abstract load(eventId: number): Promise<EventScheduleData | null>
}
