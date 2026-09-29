import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { SCRIPT_STAMP } from '../testing/identity-fixtures.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { GetCurrentUserUseCase } from './get-current-user.use-case.js'

describe('GetCurrentUserUseCase', () => {
  let users: InMemoryUserRepository
  let getCurrentUser: GetCurrentUserUseCase
  let ana: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    getCurrentUser = new GetCurrentUserUseCase(users)
    ana = await users.create(
      {
        name: 'Ana',
        email: Email.create('ana@example.com'),
        passwordHash: 'hashed:pw',
        role: 'USER',
      },
      SCRIPT_STAMP,
    )
  })

  it('returns the User the token was issued to', async () => {
    const user = await getCurrentUser.execute({ userId: ana.id, issuedAt: 1_000 })

    expect(user.email.value).toBe('ana@example.com')
  })

  it('rejects a token for a User that no longer exists', async () => {
    await expect(getCurrentUser.execute({ userId: 999, issuedAt: 1_000 })).rejects.toEqual(
      new AppError('UNAUTHENTICATED'),
    )
  })

  it('rejects a token issued before the last password change', async () => {
    ana.changePassword('hashed:new', { by: ana.id, at: new Date(2_000_000) })
    await users.save(ana)

    await expect(getCurrentUser.execute({ userId: ana.id, issuedAt: 1_999 })).rejects.toEqual(
      new AppError('UNAUTHENTICATED'),
    )
    await expect(getCurrentUser.execute({ userId: ana.id, issuedAt: 2_000 })).resolves.toBe(ana)
  })
})
