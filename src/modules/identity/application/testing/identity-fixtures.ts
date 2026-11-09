import { Phone } from '../../../../shared/domain/phone.vo.js'
import type { Stamp } from '../../../../shared/domain/stamp.js'
import { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'

/** A write with no Author (a platform script), for arranging state where the Author does not matter. */
export const SCRIPT_STAMP: Stamp = { by: null, at: new Date('2026-09-01T12:00:00.000Z') }

/** A valid phone, for arranging Users where the phone does not matter. */
export const PHONE = Phone.create('+5511900000000')

/** Links the User to a Clerk user, as their first sign-in would (authored by the User): active from then on. */
export async function signedIn(users: UserRepository, user: User): Promise<User> {
  user.linkToClerk(`user_${user.id}`, { by: user.id, at: SCRIPT_STAMP.at })
  await users.save(user)
  return user
}

/**
 * Marks the User as a Deactivated user in the in-memory repository: the real
 * mark is set by the database or a script (no route yet, PROJ-99), and
 * `PrismaUserRepository.save` does not write it.
 */
export async function deactivated(users: UserRepository, userId: number): Promise<User> {
  const user = await users.findById(userId)
  if (!user) throw new Error(`No User ${userId}`)
  const marked = User.restore({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
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
