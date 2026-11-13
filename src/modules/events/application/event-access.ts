import { AppError } from '../../../shared/domain/app-error.js'
import { type EventActor, EventAccessPolicy } from '../domain/event-access-policy.js'
import type { ActingUser } from './actor.js'
import type { GroupDirectory } from './ports/group-directory.js'

/**
 * Lets the user see the Events of a Group: the Super admin or any Group member.
 * Who cannot see the Group, or a Group that does not exist, gets NOT_FOUND, so
 * its existence does not leak.
 */
export async function requireEventsReader(
  user: ActingUser,
  groupId: number,
  directory: GroupDirectory,
): Promise<void> {
  await visibleActor(user, groupId, directory)
}

/** Lets the user create and edit the Events of a Group: like the reader check, plus FORBIDDEN for a Viewer. */
export async function requireEventsManager(
  user: ActingUser,
  groupId: number,
  directory: GroupDirectory,
): Promise<void> {
  const actor = await visibleActor(user, groupId, directory)
  if (!EventAccessPolicy.can(actor, 'manageEvents')) throw new AppError('FORBIDDEN')
}

async function visibleActor(
  user: ActingUser,
  groupId: number,
  directory: GroupDirectory,
): Promise<EventActor> {
  // The Super admin is never a Group member: their access comes from the role.
  const actor: EventActor = user.isSuperAdmin
    ? { isSuperAdmin: true, role: null }
    : { isSuperAdmin: false, role: await directory.roleIn(groupId, user.id) }
  const visible =
    EventAccessPolicy.can(actor, 'viewEvents') &&
    (!actor.isSuperAdmin || (await directory.exists(groupId)))
  if (!visible) throw new AppError('NOT_FOUND')
  return actor
}
