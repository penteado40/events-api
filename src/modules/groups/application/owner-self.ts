import { AppError } from '../../../shared/domain/app-error.js'
import type { GroupRoster } from '../domain/group-roster.js'

/**
 * Confirms, on the Roster read under the lock, that the User is still an Owner
 * of the Group: the AccessPolicy judged a Membership read before the lock, and
 * an Owner demoted or removed meanwhile no longer steps down.
 */
export function assertStillOwner(roster: GroupRoster, userId: number): void {
  const role = roster.roleOf(userId)
  if (role === null) throw new AppError('NOT_FOUND')
  if (role !== 'OWNER') throw new AppError('FORBIDDEN')
}
