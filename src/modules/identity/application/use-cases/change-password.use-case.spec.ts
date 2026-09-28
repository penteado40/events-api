import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakePasswordHasher } from '../testing/fake-password-hasher.js'
import { FakeTokenIssuer } from '../testing/fake-token-issuer.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { ChangePasswordUseCase } from './change-password.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')

describe('ChangePasswordUseCase', () => {
  let users: InMemoryUserRepository
  let changePassword: ChangePasswordUseCase
  let ana: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    changePassword = new ChangePasswordUseCase(
      users,
      new FakePasswordHasher(),
      new FakeTokenIssuer(),
      { now: () => NOW },
    )
    ana = await users.create({
      name: 'Ana',
      email: Email.create('ana@example.com'),
      passwordHash: 'hashed:current-password',
      role: 'USER',
    })
  })

  it('saves the new password, marks the change time and returns a new session', async () => {
    const result = await changePassword.execute({
      user: ana,
      currentPassword: 'current-password',
      newPassword: 'brand-new-password',
    })

    expect(result.token).toBe('token-for-1')
    const stored = await users.findById(ana.id)
    expect(stored?.passwordHash).toBe('hashed:brand-new-password')
    expect(stored?.passwordChangedAt).toEqual(NOW)
  })

  it('refuses a wrong current password with INVALID_CURRENT_PASSWORD', async () => {
    await expect(
      changePassword.execute({
        user: ana,
        currentPassword: 'wrong-password',
        newPassword: 'brand-new-password',
      }),
    ).rejects.toEqual(new AppError('INVALID_CURRENT_PASSWORD'))
    expect((await users.findById(ana.id))?.passwordHash).toBe('hashed:current-password')
  })

  it('refuses a weak new password with WEAK_PASSWORD', async () => {
    await expect(
      changePassword.execute({
        user: ana,
        currentPassword: 'current-password',
        newPassword: 'short',
      }),
    ).rejects.toEqual(new AppError('WEAK_PASSWORD'))
    expect((await users.findById(ana.id))?.passwordChangedAt).toBeNull()
  })
})
