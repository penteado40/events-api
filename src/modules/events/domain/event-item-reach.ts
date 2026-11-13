import type { GroupRole } from './event-access-policy.js'
import type { EventItemSnapshot } from './event-item.entity.js'

/** A Group member as the reach rule needs them: who, and with which role. */
export interface ReachMember {
  userId: number
  role: GroupRole
}

/**
 * Who an Event item reaches (ADR-0019, the one reach rule): the ids of the
 * Users, in the order of the members given. An item that does not exist (not
 * yet created, or already deleted) reaches no one. Until the rule covers the
 * Viewers (Draft, Audience, Participants), an item reaches only the Owners.
 * Pure: it never reads, so the reach of before and of after come from it alike.
 */
export function eventItemReach(
  item: EventItemSnapshot | null,
  members: readonly ReachMember[],
): number[] {
  if (item === null) return []
  return members.filter((m) => m.role === 'OWNER').map((m) => m.userId)
}
