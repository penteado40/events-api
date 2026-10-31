import type { Stamp } from '../../../../shared/domain/stamp.js'
import { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'

/** A write with no Author (a platform script), for arranging state where the Author does not matter. */
export const SCRIPT_STAMP: Stamp = { by: null, at: new Date('2026-09-01T12:00:00.000Z') }

/** Links the User to a Clerk user, as their first sign-in would (authored by the User): active from then on. */
export async function signedIn(users: UserRepository, user: User): Promise<User> {
  user.linkToClerk(`user_${user.id}`, { by: user.id, at: SCRIPT_STAMP.at })
  await users.save(user)
  return user
}

/** Marks the User as a Deactivated user, as the database or a script does (no route yet, PROJ-99). */
export async function deactivated(users: UserRepository, userId: number): Promise<User> {
  const user = await users.findById(userId)
  if (!user) throw new Error(`No User ${userId}`)
  const marked = User.restore({
    id: user.id,
    name: user.name,
    email: user.email,
    clerkId: user.clerkId,
    role: user.role,
    deactivatedAt: SCRIPT_STAMP.at,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdById: user.createdById,
    updatedById: user.updatedById,
  })
  await users.save(marked)
  return marked
}
