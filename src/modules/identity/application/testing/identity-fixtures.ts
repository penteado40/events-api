import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'

/** A write with no Author (a platform script), for arranging state where the Author does not matter. */
export const SCRIPT_STAMP: Stamp = { by: null, at: new Date('2026-09-01T12:00:00.000Z') }

/** Links the User to a Clerk user, as their first sign-in would (authored by the User): active from then on. */
export async function signedIn(users: UserRepository, user: User): Promise<User> {
  user.linkToClerk(`user_${user.id}`, { by: user.id, at: SCRIPT_STAMP.at })
  await users.save(user)
  return user
}
