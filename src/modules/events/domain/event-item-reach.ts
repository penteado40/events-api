import { type EventActor, EventAccessPolicy, type GroupMemberRole } from './event-access-policy.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import type { CancellableEventState, EventState } from './event.entity.js'

/** The Event as the reach rule needs it: its state, and the state before a cancel. */
export interface ReachEvent {
  state: EventState
  cancelledFrom: CancellableEventState | null
}

/**
 * The standing of a person in the Event, as the reach rule needs it: whether
 * they are the production (an Owner of the Group, or the Super admin) and
 * whether they are a Participant of the Event.
 */
export interface EventStanding {
  production: boolean
  participant: boolean
}

/** Whom the reach rule weighs an Event item against: the Event, its Group members and its Participants. */
export interface ItemReachContext {
  event: ReachEvent
  members: readonly GroupMemberRole[]
  /** The User ids of the Participants of the Event. */
  participants: readonly number[]
}

/**
 * The standing of an actor in the Event: the production is who edits the Events
 * of the Group (EventAccessPolicy), the one place that says so.
 */
export function standingOf(actor: EventActor, participant: boolean): EventStanding {
  return { production: EventAccessPolicy.can(actor, 'editEvents'), participant }
}

/**
 * Whether an Event item reaches a person (ADR-0019, the one reach rule). The
 * production sees every item, Draft included. Every item has the Audience
 * "Todos" for now: it reaches the Participants once both the Event and the
 * item are released, the item published or Cancelled (shown with its seal);
 * a Cancelled Event keeps reaching whom it reached before the cancel. Draft
 * never reaches a Viewer, and a Viewer who is not a Participant is reached by
 * no item. Pure: it never reads, so the reach of before and of after come
 * from it alike.
 */
export function eventItemReaches(
  item: EventItemSnapshot,
  event: ReachEvent,
  standing: EventStanding,
): boolean {
  if (standing.production) return true
  return standing.participant && isReleased(event) && item.state !== 'DRAFT'
}

/**
 * Who an Event item reaches: the ids of the Group members it reaches, in the
 * order of the members given, by eventItemReaches. An Owner is the production
 * whether or not a Participant. An item that does not exist (not yet created,
 * or already deleted) reaches no one.
 */
export function eventItemReach(
  item: EventItemSnapshot | null,
  context: ItemReachContext,
): number[] {
  if (item === null) return []
  return context.members
    .filter((m) =>
      eventItemReaches(
        item,
        context.event,
        standingOf({ isSuperAdmin: false, role: m.role }, context.participants.includes(m.userId)),
      ),
    )
    .map((m) => m.userId)
}

/** A published Event, or a Cancelled one that had been published. */
function isReleased(event: ReachEvent): boolean {
  return event.state === 'PUBLISHED' || event.cancelledFrom === 'PUBLISHED'
}
