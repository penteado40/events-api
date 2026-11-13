import type { Stamp } from '../../../shared/domain/stamp.js'
import type { Event, NewEventProps } from './event.entity.js'

export abstract class EventRepository {
  abstract findById(id: number): Promise<Event | null>
  /**
   * Reads the Event and locks it until the unit of work ends, so edits of the
   * same Event run one after the other and each Change starts from what the
   * last one left. Only inside UnitOfWork.run.
   */
  abstract lockById(id: number): Promise<Event | null>
  /** The Events of the Group, by start date. */
  abstract findByGroup(groupId: number): Promise<Event[]>
  /** A new Event is born in Draft. */
  abstract create(props: NewEventProps, stamp: Stamp): Promise<Event>
  abstract save(event: Event): Promise<void>
}
