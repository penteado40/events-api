import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakeActivationTokenGenerator } from '../testing/fake-activation-token-generator.js'
import { FakePasswordHasher } from '../testing/fake-password-hasher.js'
import { FakeTokenIssuer } from '../testing/fake-token-issuer.js'
import { SCRIPT_STAMP } from '../testing/identity-fixtures.js'
import { InMemoryActivationLinkRepository } from '../testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { ActivateUserUseCase } from './activate-user.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')
const STRONG = 'A-strong-password-1'
/** The Super admin (id 99, not in this repository) created Pedro and his link. */
const BY_SUPER_ADMIN = { by: 99, at: new Date('2026-09-27T12:00:00.000Z') }

describe('ActivateUserUseCase', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let clock: FixedClock
  let activate: ActivateUserUseCase
  let pedro: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository(users)
    clock = new FixedClock(NOW)
    activate = new ActivateUserUseCase(
      users,
      links,
      new FakeActivationTokenGenerator(),
      new FakePasswordHasher(),
      new FakeTokenIssuer(),
      clock,
    )
    pedro = await users.create(
      {
        name: 'Pedro',
        email: Email.create('pedro@example.com'),
        passwordHash: null,
        role: 'USER',
      },
      BY_SUPER_ADMIN,
    )
    await links.replaceForUser(
      {
        userId: pedro.id,
        tokenHash: 'hash:pedro-token',
        expiresAt: new Date('2026-10-05T12:00:00.000Z'),
      },
      BY_SUPER_ADMIN,
    )
  })

  it('sets the password, consumes the link and returns a session', async () => {
    const result = await activate.execute({ token: 'pedro-token', password: STRONG })

    expect(result.token).toBe('token-for-1')
    expect(result.user.id).toBe(pedro.id)
    const stored = await users.findById(pedro.id)
    expect(stored?.isPending).toBe(false)
    expect(stored?.passwordHash).toBe(`hashed:${STRONG}`)
    expect(stored?.passwordChangedAt).toEqual(NOW)
    expect(links.all()[0]?.usedAt).toEqual(NOW)
  })

  it('records the User as the Author of their own activation, on the User and on the link', async () => {
    await activate.execute({ token: 'pedro-token', password: STRONG })

    const stored = await users.findById(pedro.id)
    expect(stored?.updatedById).toBe(1)
    expect(stored?.updatedAt).toEqual(NOW)
    expect(stored?.createdById).toBe(99)
    const link = links.all()[0]
    expect(link?.updatedById).toBe(1)
    expect(link?.updatedAt).toEqual(NOW)
    expect(link?.createdById).toBe(99)
  })

  it('answers ACTIVATION_LINK_INVALID for an unknown or replaced token', async () => {
    await expect(activate.execute({ token: 'made-up', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_INVALID'),
    )
  })

  it('answers ACTIVATION_LINK_USED for a token already used', async () => {
    await activate.execute({ token: 'pedro-token', password: STRONG })

    await expect(
      activate.execute({ token: 'pedro-token', password: 'another-Strong-password-1' }),
    ).rejects.toEqual(new AppError('ACTIVATION_LINK_USED'))
    expect((await users.findById(pedro.id))?.passwordHash).toBe(`hashed:${STRONG}`)
  })

  it('answers ACTIVATION_LINK_EXPIRED once the expiry is reached', async () => {
    clock.set(new Date('2026-10-05T12:00:00.000Z'))

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_EXPIRED'),
    )
    expect((await users.findById(pedro.id))?.isPending).toBe(true)
  })

  it('checks used before expired', async () => {
    links.markUsed('hash:pedro-token')
    clock.set(new Date('2026-11-01T00:00:00.000Z'))

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_USED'),
    )
  })

  it('answers WEAK_PASSWORD for a password outside the PasswordPolicy and keeps the link usable', async () => {
    await expect(activate.execute({ token: 'pedro-token', password: 'Abcde1!' })).rejects.toEqual(
      new AppError('WEAK_PASSWORD'),
    )
    expect(links.all()[0]?.isUsed).toBe(false)

    const result = await activate.execute({ token: 'pedro-token', password: 'Abcdef1!' })
    expect(result.user.isPending).toBe(false)
  })

  it('answers WEAK_PASSWORD for a password over 72 bytes', async () => {
    const tooLong = 'é'.repeat(37) // 74 bytes, 37 characters

    await expect(activate.execute({ token: 'pedro-token', password: tooLong })).rejects.toEqual(
      new AppError('WEAK_PASSWORD'),
    )
  })

  it('answers USER_ALREADY_ACTIVE when the User got a password some other way', async () => {
    pedro.changePassword('hashed:set-elsewhere', SCRIPT_STAMP)

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('USER_ALREADY_ACTIVE'),
    )
    expect(links.all()[0]?.isUsed).toBe(false)
  })

  it('answers ACTIVATION_LINK_INVALID when the link is reissued during the activation', async () => {
    const original = links.completeActivation.bind(links)
    links.completeActivation = async (link, user, stamp) => {
      await links.replaceForUser(
        { userId: user.id, tokenHash: 'hash:new', expiresAt: NOW },
        BY_SUPER_ADMIN,
      )
      return original(link, user, stamp)
    }

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_INVALID'),
    )
  })

  it('answers ACTIVATION_LINK_USED when a concurrent activation consumed the link first', async () => {
    const original = links.completeActivation.bind(links)
    links.completeActivation = async (link, user, stamp) => {
      links.markUsed(link.tokenHash)
      return original(link, user, stamp)
    }

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_USED'),
    )
  })
})
