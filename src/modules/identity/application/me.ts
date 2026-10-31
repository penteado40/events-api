import type { GroupMember } from '../domain/group-member.js'
import type { User } from '../domain/user.entity.js'
import type { GroupMembers } from './ports/group-members.js'

/**
 * The logged-in User, their Membership and whether they are the Super admin,
 * so the app knows what to show.
 */
export interface Me {
  user: User
  isSuperAdmin: boolean
  memberships: GroupMember[]
}

/** The Super admin is never a Group member: their access comes from the role. */
export async function meOf(user: User, groupMembers: GroupMembers): Promise<Me> {
  if (user.isSuperAdmin) return { user, isSuperAdmin: true, memberships: [] }
  return { user, isSuperAdmin: false, memberships: await groupMembers.ofUser(user.id) }
}
