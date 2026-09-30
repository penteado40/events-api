import type { Stamp } from '../../../shared/domain/stamp.js'
import type { Event, EventStatus, NewEventProps } from './event.entity.js'
import type { EventMember, Membership, NewEventMemberProps } from './event-member.js'
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
  /** Creates the Event and, when given, its Primary owner, in one transaction; both carry the stamp. */
  abstract create(
    props: NewEventProps,
    primaryOwnerUserId: number | null,
    stamp: Stamp,
  ): Promise<Event>
  abstract save(event: Event): Promise<void>
  /** Every Event, newest `startsAt` first. */
  abstract listAll(filter: EventListFilter): Promise<Event[]>
  /** The Events the User is a member of, newest `startsAt` first. */
  abstract listForMember(userId: number, filter: EventListFilter): Promise<EventWithMembership[]>
  abstract findMembership(eventId: number, userId: number): Promise<Membership | null>

  /** The Event's members, oldest link first. */
  abstract listMembers(eventId: number): Promise<EventMember[]>
  abstract findMember(eventId: number, userId: number): Promise<EventMember | null>
  /** Throws MEMBER_ALREADY_EXISTS when the User already is a member of the Event. */
  abstract createMember(props: NewEventMemberProps, stamp: Stamp): Promise<EventMember>
  /*
   * The writes below go through only if the stored link still matches the
   * member's `loadedMembership`; otherwise nothing is stored and they throw
   * MEMBER_CHANGED (ADR-0014).
   */
  abstract saveMember(member: EventMember): Promise<void>
  abstract deleteMember(member: EventMember): Promise<void>
  /**
   * Stores a change of Primary owner in one transaction, stepping the former
   * one down first so the Event never has two (ADR-0003).
   */
  abstract savePrimaryOwnerChange(former: EventMember | null, next: EventMember): Promise<void>
  /** In how many Events the User is a member. */
  abstract countMembershipsOf(userId: number): Promise<number>
}
