import type { Actor } from '../domain/access-policy.js'
import type { GroupMemberRepository } from '../domain/group-member.repository.js'

/** The logged-in User, as the groups context needs them (identity's User fits). */
export interface ActingUser {
  id: number
  isSuperAdmin: boolean
}

/** The User with their Group members, as the AccessPolicy judges them. The Super admin is never one. */
export async function actorOf(user: ActingUser, members: GroupMemberRepository): Promise<Actor> {
  const groupMembers = user.isSuperAdmin ? [] : await members.findByUser(user.id)
  return {
    userId: user.id,
    isSuperAdmin: user.isSuperAdmin,
    groupRoles: new Map(groupMembers.map((m) => [m.groupId, m.role])),
  }
}
