import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { FakePasswordHasher } from '../testing/fake-password-hasher.js'
import { FakeTokenIssuer } from '../testing/fake-token-issuer.js'
import { SCRIPT_STAMP } from '../testing/identity-fixtures.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { LoginUseCase } from './login.use-case.js'

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository
  let hasher: FakePasswordHasher
  let login: LoginUseCase

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    hasher = new FakePasswordHasher()
    login = new LoginUseCase(users, hasher, new FakeTokenIssuer())
    await users.create(
      {
        name: 'Ana',
        email: Email.create('ana@example.com'),
        passwordHash: 'hashed:correct-password',
        role: 'USER',
      },
      SCRIPT_STAMP,
    )
  })

  it('returns a token and the User for valid credentials', async () => {
    const result = await login.execute({ email: 'ana@example.com', password: 'correct-password' })

    expect(result.token).toBe('token-for-1')
    expect(result.expiresIn).toBe(43_200)
    expect(result.user.email.value).toBe('ana@example.com')
  })

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    await expect(
      login.execute({ email: 'ana@example.com', password: 'wrong-password' }),
    ).rejects.toEqual(new AppError('INVALID_CREDENTIALS'))
  })

  it('rejects an unknown email with the same INVALID_CREDENTIALS, still comparing a hash', async () => {
    await expect(
      login.execute({ email: 'nobody@example.com', password: 'correct-password' }),
    ).rejects.toEqual(new AppError('INVALID_CREDENTIALS'))
    expect(hasher.comparedHashes).toEqual([null])
  })

  it('normalizes the email (trim and lower case)', async () => {
    const result = await login.execute({
      email: '  Ana@Example.COM ',
      password: 'correct-password',
    })

    expect(result.user.id).toBe(1)
  })

  it('refuses a Pending user with USER_PENDING, whatever the password', async () => {
    await users.create(
      {
        name: 'Pedro',
        email: Email.create('pedro@example.com'),
        passwordHash: null,
        role: 'USER',
      },
      SCRIPT_STAMP,
    )

    await expect(
      login.execute({ email: 'pedro@example.com', password: 'anything' }),
    ).rejects.toEqual(new AppError('USER_PENDING'))
  })

  it('treats a malformed email as INVALID_CREDENTIALS', async () => {
    await expect(login.execute({ email: 'not-an-email', password: 'x' })).rejects.toEqual(
      new AppError('INVALID_CREDENTIALS'),
    )
  })
})
