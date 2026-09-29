import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { FakePasswordHasher } from '../testing/fake-password-hasher.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { CreateSuperAdminUseCase } from './create-super-admin.use-case.js'

describe('CreateSuperAdminUseCase', () => {
  let users: InMemoryUserRepository
  let createSuperAdmin: CreateSuperAdminUseCase

  beforeEach(() => {
    users = new InMemoryUserRepository()
    createSuperAdmin = new CreateSuperAdminUseCase(users, new FakePasswordHasher())
  })

  it('creates a Super admin when the email is new', async () => {
    const result = await createSuperAdmin.execute({
      email: ' Admin@Local.test ',
      name: 'Admin',
      password: 'Admin-password-123',
    })

    expect(result.outcome).toBe('created')
    expect(users.all()).toHaveLength(1)
    expect(result.user.role).toBe('SUPER_ADMIN')
    expect(result.user.email.value).toBe('admin@local.test')
    expect(result.user.passwordHash).toBe('hashed:Admin-password-123')
  })

  it('is idempotent: running twice keeps one User and the first password', async () => {
    const input = { email: 'admin@local.test', name: 'Admin', password: 'Admin-password-123' }
    await createSuperAdmin.execute(input)
    const second = await createSuperAdmin.execute({ ...input, password: 'Other-password-1' })

    expect(second.outcome).toBe('unchanged')
    expect(users.all()).toHaveLength(1)
    expect(second.user.passwordHash).toBe('hashed:Admin-password-123')
  })

  it('promotes an existing User without touching the password', async () => {
    await users.create({
      name: 'Ana',
      email: Email.create('ana@example.com'),
      passwordHash: 'hashed:original',
      role: 'USER',
    })

    const result = await createSuperAdmin.execute({
      email: 'ana@example.com',
      name: 'Ana',
      password: 'Ignored-password-1',
    })

    expect(result.outcome).toBe('promoted')
    expect(result.user.role).toBe('SUPER_ADMIN')
    expect(result.user.passwordHash).toBe('hashed:original')
    expect(result.user.passwordChangedAt).toBeNull()
  })

  it('resets the password of an existing User only when asked', async () => {
    await createSuperAdmin.execute({
      email: 'admin@local.test',
      name: 'Admin',
      password: 'Admin-password-123',
    })

    const result = await createSuperAdmin.execute({
      email: 'admin@local.test',
      name: 'Admin',
      password: 'Brand-new-password-1',
      resetPassword: true,
    })

    expect(result.passwordReset).toBe(true)
    expect(result.user.passwordHash).toBe('hashed:Brand-new-password-1')
    expect(result.user.passwordChangedAt).toBeInstanceOf(Date)
  })

  it('refuses a password outside the PasswordPolicy with WEAK_PASSWORD, in any environment', async () => {
    await expect(
      createSuperAdmin.execute({
        email: 'admin@local.test',
        name: 'Admin',
        password: 'Abcde1!',
      }),
    ).rejects.toEqual(new AppError('WEAK_PASSWORD'))
    expect(users.all()).toHaveLength(0)

    const created = await createSuperAdmin.execute({
      email: 'admin@local.test',
      name: 'Admin',
      password: 'Abcdef1!',
    })
    expect(created.outcome).toBe('created')
  })

  it('refuses the email of a Pending user with USER_PENDING, leaving them untouched', async () => {
    await users.create({
      name: 'Pedro',
      email: Email.create('pedro@example.com'),
      passwordHash: null,
      role: 'USER',
    })

    await expect(
      createSuperAdmin.execute({
        email: 'pedro@example.com',
        name: 'Pedro',
        password: 'Admin-password-123',
        resetPassword: true,
      }),
    ).rejects.toEqual(new AppError('USER_PENDING'))
    const pedro = await users.findByEmail(Email.create('pedro@example.com'))
    expect(pedro?.role).toBe('USER')
    expect(pedro?.isPending).toBe(true)
  })
})
