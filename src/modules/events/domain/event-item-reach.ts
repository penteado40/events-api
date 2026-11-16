import { type EventActor, EventAccessPolicy, type GroupMemberRole } from './event-access-policy.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import type { CancellableEventState, EventState } from './event.entity.js'

/** The Event as the reach rule needs it: its state, and the state before a cancel. */
export interface ReachEvent {
  state: EventState
  cancelledFrom: CancellableEventState | null
}

/**
 * The standing of a person in the Event, as the reach rule needs it: who they
 * are (for the Audiences chosen), whether they are the production (an Owner
 * of the Group, or the Super admin) and whether they are a Participant of the
 * Event.
 */
export interface EventStanding {
  userId: number
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
export function standingOf(actor: EventActor, userId: number, participant: boolean): EventStanding {
  return { userId, production: EventAccessPolicy.can(actor, 'editEvents'), participant }
}

/**
 * Whether an Event item reaches a person (ADR-0019, the one reach rule). The
 * production sees every item, Draft included. Anyone else is reached only
 * once both the Event and the item are released, the item published or
 * Cancelled (shown with its seal); a Cancelled Event keeps reaching whom it
 * reached before the cancel, and Draft never reaches a Viewer. Then the
 * Audience decides: "Todos" reaches the Participants, and a Viewer who is
 * not one is reached by no such item; an Audience chosen reaches only the
 * people on its list, which holds only Participants (and, later, Event
 * guests): every path that takes someone off the Participants also takes
 * them off the Audiences chosen (EventItemRepository.removeFromAudiences),
 * so the list is not checked against the Participants here. Whoever is in
 * a people Field of the item is in its Audience too, while in the Field and
 * a Participant: who left the Event stays in the Field, but out of the
 * Event, and does not count (CONTEXT.md, Audience). Pure: it never reads,
 * so the reach of before and of after come from it alike.
 */
export function eventItemReaches(
  item: EventItemSnapshot,
  event: ReachEvent,
  standing: EventStanding,
  /** The User ids in the people Fields of the item (peopleInFields). */
  peopleInFields: readonly number[],
): boolean {
  if (standing.production) return true
  if (!isReleased(event) || item.state === 'DRAFT') return false
  if (item.audience.kind === 'ALL') return standing.participant
  return (
    item.audience.userIds.includes(standing.userId) ||
    (standing.participant && peopleInFields.includes(standing.userId))
  )
}

/**
 * Who an Event item reaches: the ids of the Group members it reaches, in the
 * order of the members given, by eventItemReaches, its people Fields weighed. An Owner is the production
 * whether or not a Participant. An item that does not exist (not yet created,
 * or already deleted) reaches no one.
 */
export function eventItemReach(
  item: EventItemSnapshot | null,
  context: ItemReachContext,
  /** The User ids in the people Fields of the item (peopleInFields). */
  peopleInFields: readonly number[],
): number[] {
  if (item === null) return []
  return context.members
    .filter((m) =>
      eventItemReaches(
        item,
        context.event,
        standingOf(
          { isSuperAdmin: false, role: m.role },
          m.userId,
          context.participants.includes(m.userId),
        ),
        peopleInFields,
      ),
    )
    .map((m) => m.userId)
}

/** A published Event, or a Cancelled one that had been published. */
function isReleased(event: ReachEvent): boolean {
  return event.state === 'PUBLISHED' || event.cancelledFrom === 'PUBLISHED'
}
