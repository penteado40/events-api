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
      password: 'admin123',
    })

    expect(result.outcome).toBe('created')
    expect(users.all()).toHaveLength(1)
    expect(result.user.role).toBe('SUPER_ADMIN')
    expect(result.user.email.value).toBe('admin@local.test')
    expect(result.user.passwordHash).toBe('hashed:admin123')
  })

  it('is idempotent: running twice keeps one User and the first password', async () => {
    const input = { email: 'admin@local.test', name: 'Admin', password: 'admin123' }
    await createSuperAdmin.execute(input)
    const second = await createSuperAdmin.execute({ ...input, password: 'other-password' })

    expect(second.outcome).toBe('unchanged')
    expect(users.all()).toHaveLength(1)
    expect(second.user.passwordHash).toBe('hashed:admin123')
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
      password: 'ignored-password',
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
      password: 'admin123',
    })

    const result = await createSuperAdmin.execute({
      email: 'admin@local.test',
      name: 'Admin',
      password: 'brand-new-password',
      resetPassword: true,
    })

    expect(result.passwordReset).toBe(true)
    expect(result.user.passwordHash).toBe('hashed:brand-new-password')
    expect(result.user.passwordChangedAt).toBeInstanceOf(Date)
  })

  it('refuses a password shorter than 12 characters when strong passwords are enforced', async () => {
    const strict = new CreateSuperAdminUseCase(users, new FakePasswordHasher(), {
      enforceStrongPassword: true,
    })

    await expect(
      strict.execute({ email: 'admin@local.test', name: 'Admin', password: '12345678901' }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    expect(users.all()).toHaveLength(0)

    const created = await strict.execute({
      email: 'admin@local.test',
      name: 'Admin',
      password: '123456789012',
    })
    expect(created.outcome).toBe('created')
  })
})
