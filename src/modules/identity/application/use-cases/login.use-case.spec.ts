import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { RateLimiter } from '../../../../shared/application/rate-limiter.js'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryRateLimitStore } from '../../../../shared/application/testing/in-memory-rate-limit-store.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { FakePasswordHasher } from '../testing/fake-password-hasher.js'
import { FakeTokenIssuer } from '../testing/fake-token-issuer.js'
import { SCRIPT_STAMP } from '../testing/identity-fixtures.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { LoginUseCase } from './login.use-case.js'

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository
  let hasher: FakePasswordHasher
  let clock: FixedClock
  let login: LoginUseCase

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    hasher = new FakePasswordHasher()
    clock = new FixedClock(new Date('2026-10-02T12:00:00.000Z'))
    const limiter = new RateLimiter(new InMemoryRateLimitStore(clock), clock)
    login = new LoginUseCase(users, hasher, new FakeTokenIssuer(), limiter)
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

  describe('rate limit by email (login-email: 5 wrong passwords per 15 min)', () => {
    async function failTimes(times: number, email: string) {
      for (let i = 0; i < times; i++) {
        await expect(login.execute({ email, password: 'wrong-password' })).rejects.toEqual(
          new AppError('INVALID_CREDENTIALS'),
        )
      }
    }

    it('refuses even the right password with RATE_LIMITED after 5 wrong ones', async () => {
      await failTimes(5, 'ana@example.com')

      await expect(
        login.execute({ email: 'ana@example.com', password: 'correct-password' }),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })

    it('lets the email in again once the window ends', async () => {
      await failTimes(5, 'ana@example.com')

      clock.set(new Date('2026-10-02T12:15:00.000Z'))

      await expect(
        login.execute({ email: 'ana@example.com', password: 'correct-password' }),
      ).resolves.toMatchObject({ token: 'token-for-1' })
    })

    it('never counts a successful login', async () => {
      for (let i = 0; i < 10; i++) {
        await login.execute({ email: 'ana@example.com', password: 'correct-password' })
      }
      await failTimes(4, 'ana@example.com')

      await expect(
        login.execute({ email: 'ana@example.com', password: 'correct-password' }),
      ).resolves.toMatchObject({ token: 'token-for-1' })
    })

    it('counts the same email however it is written', async () => {
      await failTimes(3, 'ana@example.com')
      await failTimes(2, '  ANA@Example.com ')

      await expect(
        login.execute({ email: 'ana@example.com', password: 'correct-password' }),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })

    it('counts unknown emails too, so the 429 does not reveal which emails exist', async () => {
      await failTimes(5, 'nobody@example.com')

      await expect(
        login.execute({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })

    it('leaves a malformed email out: it is no account, and the IP limit covers the volume', async () => {
      for (let i = 0; i < 6; i++) {
        await expect(login.execute({ email: 'not-an-email', password: 'x' })).rejects.toEqual(
          new AppError('INVALID_CREDENTIALS'),
        )
      }
    })

    it('keeps each email apart', async () => {
      await failTimes(5, 'nobody@example.com')

      await expect(
        login.execute({ email: 'ana@example.com', password: 'correct-password' }),
      ).resolves.toMatchObject({ token: 'token-for-1' })
    })
  })
})
