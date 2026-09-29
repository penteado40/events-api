import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
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
    },
  })
  return { ...user, password }
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

export interface CreateEventOptions {
  slug?: string
  name?: string
  status?: 'ACTIVE' | 'ARCHIVED'
  startsAt?: Date
  siteUrl?: string
}

export async function createEvent(options: CreateEventOptions = {}) {
  sequence += 1
  return testPrisma().event.create({
    data: {
      type: 'WEDDING',
      name: options.name ?? `Evento ${sequence}`,
      slug: options.slug ?? `evento-${sequence}`,
      siteUrl: options.siteUrl ?? 'https://evento.com',
      status: options.status ?? 'ACTIVE',
      startsAt: options.startsAt ?? new Date('2026-11-14T22:00:00.000Z'),
    },
  })
}

export interface AddMemberOptions {
  eventId: number
  userId: number
  role: 'OWNER' | 'MANAGER' | 'VIEWER'
  isPrimaryOwner?: boolean
}

export async function addMember(options: AddMemberOptions) {
  return testPrisma().eventMember.create({
    data: { ...options, isPrimaryOwner: options.isPrimaryOwner ?? false },
  })
}
