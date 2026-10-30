import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { FakeAuthVerifier } from '../../../src/modules/identity/application/testing/fake-auth-verifier.js'
import type { Role } from '../../../src/modules/identity/index.js'
import { testPrisma } from './database.js'

let sequence = 0

export interface CreateUserOptions {
  name?: string
  email?: string
  /** `null` creates a Pending user. */
  password?: string | null
  role?: Role
  passwordChangedAt?: Date | null
  /** The linked Clerk user; null (the default) until the first request links one. */
  clerkId?: string | null
}

export async function createUser(options: CreateUserOptions = {}) {
  sequence += 1
  const password = options.password === undefined ? 'correct-password' : options.password
  const user = await testPrisma().user.create({
    data: {
      name: options.name ?? `User ${sequence}`,
      email: options.email ?? `user${sequence}@example.com`,
      passwordHash: password === null ? null : await bcrypt.hash(password, 4),
      role: options.role ?? 'USER',
      passwordChangedAt: options.passwordChangedAt ?? null,
      clerkId: options.clerkId ?? null,
    },
  })
  return { ...user, password }
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

export interface CreateActivationLinkOptions {
  userId: number
  token?: string
  expiresAt?: Date
  usedAt?: Date | null
}

/** An Activation link with a known token (stored as its SHA-256, like the app does). */
export async function createActivationLink(options: CreateActivationLinkOptions) {
  sequence += 1
  const token = options.token ?? `test-activation-token-${sequence}`
  const link = await testPrisma().activationLink.create({
    data: {
      userId: options.userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: options.expiresAt ?? new Date(Date.now() + 3600_000),
      usedAt: options.usedAt ?? null,
    },
  })
  return { ...link, token }
}
