import { FakeAuthVerifier } from '../../../src/modules/identity/application/testing/fake-auth-verifier.js'
import type { Role } from '../../../src/modules/identity/index.js'
import { testPrisma } from './database.js'

let sequence = 0

export interface CreateUserOptions {
  name?: string
  email?: string
  phone?: string
  role?: Role
  /** The linked Clerk user; null (the default, a Pending user) until the first request links one. */
  clerkId?: string | null
}

export async function createUser(options: CreateUserOptions = {}) {
  sequence += 1
  const user = await testPrisma().user.create({
    data: {
      name: options.name ?? `User ${sequence}`,
      email: options.email ?? `user${sequence}@example.com`,
      phone: options.phone ?? `+55119${String(sequence).padStart(8, '0')}`,
      role: options.role ?? 'USER',
      clerkId: options.clerkId ?? null,
    },
  })
  return user
}

/**
 * A session token the test app accepts (it verifies with FakeAuthVerifier), as
 * Clerk would issue for this email. Without a `clerkId`, it comes from a Clerk
 * user derived from the User id, which the first request links.
 */
export function sessionTokenFor(user: {
  id: number
  email: string
  clerkId?: string | null
}): string {
  return FakeAuthVerifier.tokenFor({
    externalId: user.clerkId ?? `user_test_${user.id}`,
    email: user.email,
  })
}

export async function createGroup(options: { name?: string } = {}) {
  sequence += 1
  return testPrisma().group.create({ data: { name: options.name ?? `Group ${sequence}` } })
}

/** A Group member, as the writes of PROJ-172 (Owners) and PROJ-177 (Viewers) will make. */
export async function createGroupMember(options: {
  groupId: number
  userId: number
  role?: 'OWNER' | 'VIEWER'
}) {
  return testPrisma().groupMember.create({
    data: { groupId: options.groupId, userId: options.userId, role: options.role ?? 'VIEWER' },
  })
}
