import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { CreateSuperAdminUseCase } from './create-super-admin.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')
const EARLIER_WRITE = { by: 7, at: new Date('2026-09-01T12:00:00.000Z') }

describe('CreateSuperAdminUseCase', () => {
  let users: InMemoryUserRepository
  let createSuperAdmin: CreateSuperAdminUseCase

  beforeEach(() => {
    users = new InMemoryUserRepository()
    createSuperAdmin = new CreateSuperAdminUseCase(users, new FixedClock(NOW))
  })

  it('creates a Super admin not yet linked to Clerk when the email is new', async () => {
    const result = await createSuperAdmin.execute({ email: ' Admin@Local.test ', name: 'Admin' })

    expect(result.outcome).toBe('created')
    expect(users.all()).toHaveLength(1)
    expect(result.user.role).toBe('SUPER_ADMIN')
    expect(result.user.email.value).toBe('admin@local.test')
    expect(result.user.clerkId).toBeNull()
    expect(result.user.isPending).toBe(true)
  })

  it('records no Author for the Super admin it creates: no User made the write', async () => {
    const { user } = await createSuperAdmin.execute({ email: 'admin@local.test', name: 'Admin' })

    expect(user.createdById).toBeNull()
    expect(user.updatedById).toBeNull()
    expect(user.createdAt).toEqual(NOW)
  })

  it('is idempotent: running twice keeps one User, unchanged', async () => {
    const input = { email: 'admin@local.test', name: 'Admin' }
    await createSuperAdmin.execute(input)
    const second = await createSuperAdmin.execute({ ...input, name: 'Other name' })

    expect(second.outcome).toBe('unchanged')
    expect(users.all()).toHaveLength(1)
    expect(second.user.name).toBe('Admin')
  })

  it('promotes an existing User, keeping their Clerk link, with no Author for the change', async () => {
    const ana = await users.create(
      { name: 'Ana', email: Email.create('ana@example.com'), role: 'USER' },
      EARLIER_WRITE,
    )
    ana.linkToClerk('user_ana', EARLIER_WRITE)
    await users.save(ana)

    const result = await createSuperAdmin.execute({ email: 'ana@example.com', name: 'Ana' })

    expect(result.outcome).toBe('promoted')
    expect(result.user.role).toBe('SUPER_ADMIN')
    expect(result.user.clerkId).toBe('user_ana')
    expect(result.user.createdById).toBe(7)
    expect(result.user.updatedById).toBeNull()
    expect(result.user.updatedAt).toEqual(NOW)
  })

  it('promotes a Pending user too: they enter through the Clerk invitation', async () => {
    await users.create(
      { name: 'Pedro', email: Email.create('pedro@example.com'), role: 'USER' },
      EARLIER_WRITE,
    )

    const result = await createSuperAdmin.execute({ email: 'pedro@example.com', name: 'Pedro' })

    expect(result.outcome).toBe('promoted')
    expect(result.user.isSuperAdmin).toBe(true)
    expect(result.user.isPending).toBe(true)
  })

  it('refuses an invalid email with VALIDATION_ERROR, creating nothing', async () => {
    await expect(
      createSuperAdmin.execute({ email: 'not-an-email', name: 'Admin' }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    expect(users.all()).toHaveLength(0)
  })
})
