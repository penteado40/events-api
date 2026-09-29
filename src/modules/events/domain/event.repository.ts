import type { Event, EventStatus, NewEventProps } from './event.entity.js'
import type { Membership } from './event-member.js'
import type { Slug } from './slug.vo.js'

export interface EventListFilter {
  status?: EventStatus
}

/** An Event as one User sees it: with their Membership (null for the Super admin). */
export interface EventWithMembership {
  event: Event
  membership: Membership | null
}

export abstract class EventRepository {
  abstract findById(id: number): Promise<Event | null>
  abstract findBySlug(slug: Slug): Promise<Event | null>
  /** Creates the Event and, when given, its Primary owner, in one transaction. */
  abstract create(props: NewEventProps, primaryOwnerUserId: number | null): Promise<Event>
  abstract save(event: Event): Promise<void>
  /** Every Event, newest `startsAt` first. */
  abstract listAll(filter: EventListFilter): Promise<Event[]>
  /** The Events the User is a member of, newest `startsAt` first. */
  abstract listForMember(userId: number, filter: EventListFilter): Promise<EventWithMembership[]>
  abstract findMembership(eventId: number, userId: number): Promise<Membership | null>
}
