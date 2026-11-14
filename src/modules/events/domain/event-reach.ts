import type { GroupMemberRole } from './event-access-policy.js'

/**
 * Who an Event reaches: where and when are seen by every Group member, Draft
 * included, so every Change of the Event reaches them all (the ids of the
 * Users, in the order of the members given). An Event item reaches whom
 * eventItemReach says.
 */
export function eventReach(members: readonly GroupMemberRole[]): number[] {
  return members.map((m) => m.userId)
}
