import { AppError } from '../../../shared/domain/app-error.js'
import { AccessPolicy } from '../domain/access-policy.js'
import type { GroupMemberRepository } from '../domain/group-member.repository.js'
import type { GroupRepository } from '../domain/group.repository.js'
import { type ActingUser, actorOf } from './actor.js'

/** The Groups and Group members a Teams use case reads access from. */
export interface TeamsAccessSources {
  groups: GroupRepository
  members: GroupMemberRepository
}

/**
 * Lets the user read the Teams of a Group: the Super admin or any Group member.
 * Who cannot see the Group gets NOT_FOUND, so its existence does not leak.
 */
export async function requireTeamsReader(
  user: ActingUser,
  groupId: number,
  sources: TeamsAccessSources,
): Promise<void> {
  await requireVisible(await actorOf(user, sources.members), groupId, sources.groups)
}

/**
 * Lets the user change the Teams of a Group: the Super admin or an Owner. Like
 * the reader check, plus FORBIDDEN for a Group member who is not an Owner.
 */
export async function requireTeamsManager(
  user: ActingUser,
  groupId: number,
  sources: TeamsAccessSources,
): Promise<void> {
  const actor = await actorOf(user, sources.members)
  await requireVisible(actor, groupId, sources.groups)
  if (!AccessPolicy.can(actor, { type: 'manageTeams', groupId })) throw new AppError('FORBIDDEN')
}

async function requireVisible(
  actor: Awaited<ReturnType<typeof actorOf>>,
  groupId: number,
  groups: GroupRepository,
): Promise<void> {
  const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
    ? await groups.findById(groupId)
    : null
  if (!group) throw new AppError('NOT_FOUND')
}
