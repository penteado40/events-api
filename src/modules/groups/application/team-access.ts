import { AppError } from '../../../shared/domain/app-error.js'
import { AccessPolicy } from '../domain/access-policy.js'
import type { GroupMemberRepository } from '../domain/group-member.repository.js'
import type { GroupRepository } from '../domain/group.repository.js'
import { type ActingUser, actorOf } from './actor.js'

/**
 * Lets the user into the Teams of a Group: anyone who sees the Group may read,
 * only the Super admin or an Owner may manage. Who cannot see the Group gets
 * NOT_FOUND, so its existence does not leak; a Viewer who manages gets FORBIDDEN.
 */
export async function requireTeamsAccess(
  user: ActingUser,
  groupId: number,
  mode: 'read' | 'manage',
  groups: GroupRepository,
  members: GroupMemberRepository,
): Promise<void> {
  const actor = await actorOf(user, members)
  const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
    ? await groups.findById(groupId)
    : null
  if (!group) throw new AppError('NOT_FOUND')
  if (mode === 'manage' && !AccessPolicy.can(actor, { type: 'manageTeams', groupId })) {
    throw new AppError('FORBIDDEN')
  }
}
