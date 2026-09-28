import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakeActivationTokenGenerator } from '../testing/fake-activation-token-generator.js'
import { FakePasswordHasher } from '../testing/fake-password-hasher.js'
import { FakeTokenIssuer } from '../testing/fake-token-issuer.js'
import { InMemoryActivationLinkRepository } from '../testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { ActivateUserUseCase } from './activate-user.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')
const STRONG = 'a-strong-password'

describe('ActivateUserUseCase', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let now: Date
  let activate: ActivateUserUseCase
  let pedro: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository(users)
    now = NOW
    activate = new ActivateUserUseCase(
      users,
      links,
      new FakeActivationTokenGenerator(),
      new FakePasswordHasher(),
      new FakeTokenIssuer(),
      { now: () => now },
    )
    pedro = await users.create({
      name: 'Pedro',
      email: Email.create('pedro@example.com'),
      passwordHash: null,
      role: 'USER',
    })
    await links.replaceForUser({
      userId: pedro.id,
      tokenHash: 'hash:pedro-token',
      expiresAt: new Date('2026-10-05T12:00:00.000Z'),
    })
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

  it('answers ACTIVATION_LINK_INVALID for an unknown or replaced token', async () => {
    await expect(activate.execute({ token: 'made-up', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_INVALID'),
    )
  })

  it('answers ACTIVATION_LINK_USED for a token already used', async () => {
    await activate.execute({ token: 'pedro-token', password: STRONG })

    await expect(
      activate.execute({ token: 'pedro-token', password: 'another-strong-password' }),
    ).rejects.toEqual(new AppError('ACTIVATION_LINK_USED'))
    expect((await users.findById(pedro.id))?.passwordHash).toBe(`hashed:${STRONG}`)
  })

  it('answers ACTIVATION_LINK_EXPIRED once the expiry is reached', async () => {
    now = new Date('2026-10-05T12:00:00.000Z')

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_EXPIRED'),
    )
    expect((await users.findById(pedro.id))?.isPending).toBe(true)
  })

  it('checks used before expired', async () => {
    links.markUsed('hash:pedro-token')
    now = new Date('2026-11-01T00:00:00.000Z')

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_USED'),
    )
  })

  it('answers WEAK_PASSWORD for a short password and keeps the link usable', async () => {
    await expect(
      activate.execute({ token: 'pedro-token', password: '12345678901' }),
    ).rejects.toEqual(new AppError('WEAK_PASSWORD'))
    expect(links.all()[0]?.isUsed).toBe(false)

    const result = await activate.execute({ token: 'pedro-token', password: '123456789012' })
    expect(result.user.isPending).toBe(false)
  })

  it('answers WEAK_PASSWORD for a password over 72 bytes', async () => {
    const tooLong = 'é'.repeat(37) // 74 bytes, 37 characters

    await expect(activate.execute({ token: 'pedro-token', password: tooLong })).rejects.toEqual(
      new AppError('WEAK_PASSWORD'),
    )
  })

  it('answers USER_ALREADY_ACTIVE when the User got a password some other way', async () => {
    pedro.changePassword('hashed:set-elsewhere')

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('USER_ALREADY_ACTIVE'),
    )
    expect(links.all()[0]?.isUsed).toBe(false)
  })

  it('answers ACTIVATION_LINK_INVALID when the link is reissued during the activation', async () => {
    const original = links.completeActivation.bind(links)
    links.completeActivation = async (link, user, at) => {
      await links.replaceForUser({ userId: user.id, tokenHash: 'hash:new', expiresAt: NOW })
      return original(link, user, at)
    }

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_INVALID'),
    )
  })

  it('answers ACTIVATION_LINK_USED when a concurrent activation consumed the link first', async () => {
    const original = links.completeActivation.bind(links)
    links.completeActivation = async (link, user, at) => {
      links.markUsed(link.tokenHash)
      return original(link, user, at)
    }

    await expect(activate.execute({ token: 'pedro-token', password: STRONG })).rejects.toEqual(
      new AppError('ACTIVATION_LINK_USED'),
    )
  })
})
