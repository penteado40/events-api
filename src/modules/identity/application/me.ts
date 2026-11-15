import type { GroupMember } from '../domain/group-member.js'
import type { User } from '../domain/user.entity.js'
import type { EventParticipations } from './ports/event-participations.js'
import type { GroupMembers } from './ports/group-members.js'

/** One Group of the Membership: the role there and the Events of it the User is a Participant of. */
export interface GroupMembership extends GroupMember {
  /** In the order the Events were created. */
  participantEventIds: number[]
}

/**
 * The logged-in User, their Membership and whether they are the Super admin,
 * so the app knows what to show.
 */
export interface Me {
  user: User
  isSuperAdmin: boolean
  memberships: GroupMembership[]
}

/** The Super admin is never a Group member: their access comes from the role. */
export async function meOf(
  user: User,
  groupMembers: GroupMembers,
  participations: EventParticipations,
): Promise<Me> {
  if (user.isSuperAdmin) return { user, isSuperAdmin: true, memberships: [] }
  const [groups, events] = await Promise.all([
    groupMembers.ofUser(user.id),
    participations.ofUser(user.id),
  ])
  const memberships = groups.map((group) => ({
    ...group,
    participantEventIds: events.filter((e) => e.groupId === group.groupId).map((e) => e.eventId),
  }))
  return { user, isSuperAdmin: false, memberships }
}
