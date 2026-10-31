import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakeAuthVerifier } from '../testing/fake-auth-verifier.js'
import { SCRIPT_STAMP, PHONE } from '../testing/identity-fixtures.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { AuthenticateUseCase } from './authenticate.use-case.js'

const NOW = new Date('2026-10-30T12:00:00.000Z')

/** Another request links the User between this request's read and its write. */
class RacedUserRepository extends InMemoryUserRepository {
  concurrentLink: { userId: number; clerkId: string } | null = null

  override async findByEmail(email: Email): Promise<User | null> {
    const user = await super.findByEmail(email)
    if (this.concurrentLink) {
      this.linkConcurrently(this.concurrentLink.userId, this.concurrentLink.clerkId)
    }
    return user
  }
}

describe('AuthenticateUseCase', () => {
  let users: RacedUserRepository
  let authenticate: AuthenticateUseCase
  let ana: User

  beforeEach(async () => {
    users = new RacedUserRepository()
    authenticate = new AuthenticateUseCase(users, new FakeAuthVerifier(), new FixedClock(NOW))
    ana = await users.create(
      { name: 'Ana', email: Email.create('ana@example.com'), phone: PHONE, role: 'USER' },
      SCRIPT_STAMP,
    )
  })

  function tokenFor(externalId: string, email: string): string {
    return FakeAuthVerifier.tokenFor({ externalId, email })
  }

  it('links an unknown externalId to the User with its email, authored by that User', async () => {
    const user = await authenticate.execute({ token: tokenFor('user_ana', 'ana@example.com') })

    expect(user.id).toBe(ana.id)
    const stored = await users.findById(ana.id)
    expect(stored?.clerkId).toBe('user_ana')
    expect(stored?.updatedAt).toEqual(NOW)
    expect(stored?.updatedById).toBe(ana.id)
  })

  it('matches the email ignoring case and surrounding spaces', async () => {
    const user = await authenticate.execute({ token: tokenFor('user_ana', ' Ana@Example.com ') })

    expect(user.id).toBe(ana.id)
  })

  it('finds an already linked User by the externalId, even after the email changed', async () => {
    await authenticate.execute({ token: tokenFor('user_ana', 'ana@example.com') })

    const user = await authenticate.execute({ token: tokenFor('user_ana', 'ana@new.example.com') })

    expect(user.id).toBe(ana.id)
  })

  it('refuses an email that belongs to no User with USER_NOT_INVITED', async () => {
    await expect(
      authenticate.execute({ token: tokenFor('user_bob', 'bob@example.com') }),
    ).rejects.toEqual(new AppError('USER_NOT_INVITED'))
  })

  it('refuses an email whose User is linked to another externalId, keeping the link', async () => {
    await authenticate.execute({ token: tokenFor('user_ana', 'ana@example.com') })

    await expect(
      authenticate.execute({ token: tokenFor('user_other', 'ana@example.com') }),
    ).rejects.toEqual(new AppError('UNAUTHENTICATED'))
    expect((await users.findById(ana.id))?.clerkId).toBe('user_ana')
  })

  it('keeps the link of another Clerk user that won a concurrent first sign-in', async () => {
    users.concurrentLink = { userId: ana.id, clerkId: 'user_other' }

    await expect(
      authenticate.execute({ token: tokenFor('user_ana', 'ana@example.com') }),
    ).rejects.toEqual(new AppError('UNAUTHENTICATED'))
    expect((await users.findByClerkId('user_other'))?.id).toBe(ana.id)
    expect(await users.findByClerkId('user_ana')).toBeNull()
  })

  it('accepts a concurrent first sign-in of the same Clerk user', async () => {
    users.concurrentLink = { userId: ana.id, clerkId: 'user_ana' }

    const user = await authenticate.execute({ token: tokenFor('user_ana', 'ana@example.com') })

    expect(user.id).toBe(ana.id)
  })

  it('refuses a token the verifier does not accept with UNAUTHENTICATED', async () => {
    await expect(authenticate.execute({ token: 'garbage' })).rejects.toEqual(
      new AppError('UNAUTHENTICATED'),
    )
  })

  it('refuses a verified identity whose email is not an email with UNAUTHENTICATED', async () => {
    await expect(
      authenticate.execute({ token: tokenFor('user_ana', 'not-an-email') }),
    ).rejects.toEqual(new AppError('UNAUTHENTICATED'))
  })
})
