import bcrypt from 'bcryptjs'
import type { Role } from '../../../src/modules/identity/index.js'
import { testPrisma } from './database.js'

let sequence = 0

export interface CreateUserOptions {
  name?: string
  email?: string
  password?: string
  role?: Role
  passwordChangedAt?: Date | null
}

export async function createUser(options: CreateUserOptions = {}) {
  sequence += 1
  const password = options.password ?? 'correct-password'
  const user = await testPrisma().user.create({
    data: {
      name: options.name ?? `User ${sequence}`,
      email: options.email ?? `user${sequence}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      role: options.role ?? 'USER',
      passwordChangedAt: options.passwordChangedAt ?? null,
    },
  })
  return { ...user, password }
}
