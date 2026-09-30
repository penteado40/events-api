import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakeActivationTokenGenerator } from '../testing/fake-activation-token-generator.js'
import { SCRIPT_STAMP } from '../testing/identity-fixtures.js'
import { InMemoryActivationLinkRepository } from '../testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { CreateUserUseCase } from './create-user.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')
const SEVEN_DAYS = 7 * 24 * 60 * 60

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let createUser: CreateUserUseCase
  let superAdmin: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository(users)
    createUser = new CreateUserUseCase(
      users,
      links,
      new FakeActivationTokenGenerator(),
      new FixedClock(NOW),
      { ttlSeconds: SEVEN_DAYS },
    )
    superAdmin = await users.create(
      {
        name: 'Admin',
        email: Email.create('admin@example.com'),
        passwordHash: 'hashed:admin-password',
        role: 'SUPER_ADMIN',
      },
      SCRIPT_STAMP,
    )
  })

  it('creates a Pending user with an Activation link valid for the TTL', async () => {
    const result = await createUser.execute({
      actor: superAdmin,
      name: '  Pedro  ',
      email: ' Pedro@Example.com ',
    })

    expect(result.user.name).toBe('Pedro')
    expect(result.user.email.value).toBe('pedro@example.com')
    expect(result.user.role).toBe('USER')
    expect(result.user.isPending).toBe(true)
    expect(result.activationToken).toBe('token-1')
    expect(result.expiresAt).toEqual(new Date('2026-10-05T12:00:00.000Z'))
    expect(links.all()).toHaveLength(1)
    expect(links.all()[0]?.userId).toBe(result.user.id)
    expect(links.all()[0]?.tokenHash).toBe('hash:token-1')
  })

  it('records the Super admin as the Author of the User and of the Activation link', async () => {
    const { user } = await createUser.execute({
      actor: superAdmin,
      name: 'Pedro',
      email: 'pedro@example.com',
    })

    expect(user.createdById).toBe(1)
    expect(user.updatedById).toBe(1)
    expect(user.createdAt).toEqual(NOW)
    expect(user.updatedAt).toEqual(NOW)
    expect(links.all()[0]?.createdById).toBe(1)
    expect(links.all()[0]?.createdAt).toEqual(NOW)
  })

  it('refuses an actor who is not the Super admin with FORBIDDEN', async () => {
    const ana = await users.create(
      {
        name: 'Ana',
        email: Email.create('ana@example.com'),
        passwordHash: 'hashed:x',
        role: 'USER',
      },
      SCRIPT_STAMP,
    )

    await expect(
      createUser.execute({ actor: ana, name: 'Pedro', email: 'pedro@example.com' }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(users.all()).toHaveLength(2)
  })

  it('refuses an email that already has a User with EMAIL_ALREADY_IN_USE, ignoring case', async () => {
    await expect(
      createUser.execute({ actor: superAdmin, name: 'Other', email: 'ADMIN@example.com' }),
    ).rejects.toEqual(new AppError('EMAIL_ALREADY_IN_USE'))
    expect(links.all()).toHaveLength(0)
  })

  it('refuses a malformed email with VALIDATION_ERROR', async () => {
    await expect(
      createUser.execute({ actor: superAdmin, name: 'Pedro', email: 'not-an-email' }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })
})
