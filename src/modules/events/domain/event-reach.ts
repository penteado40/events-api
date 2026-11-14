import type { GroupMemberRole } from './event-access-policy.js'

/**
 * Who a Change of the Event reaches: every Group member, Draft included (the
 * ids of the Users, in the order of the members given). Where and when are
 * seen by all of them; a Change only the production sees (the order of the
 * Event items) keeps the same reach and is told apart by productionOnly. A
 * Change of an Event item reaches whom eventItemReach says.
 */
export function eventReach(members: readonly GroupMemberRole[]): number[] {
  return members.map((m) => m.userId)
}
