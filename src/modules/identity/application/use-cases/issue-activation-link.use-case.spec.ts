import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakeActivationTokenGenerator } from '../testing/fake-activation-token-generator.js'
import { InMemoryActivationLinkRepository } from '../testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { IssueActivationLinkUseCase } from './issue-activation-link.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')

describe('IssueActivationLinkUseCase', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let issueLink: IssueActivationLinkUseCase
  let superAdmin: User
  let pedro: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository(users)
    issueLink = new IssueActivationLinkUseCase(users, links, new FakeActivationTokenGenerator(), {
      ttlSeconds: 3600,
      now: () => NOW,
    })
    superAdmin = await users.create({
      name: 'Admin',
      email: Email.create('admin@example.com'),
      passwordHash: 'hashed:admin-password',
      role: 'SUPER_ADMIN',
    })
    pedro = await users.create({
      name: 'Pedro',
      email: Email.create('pedro@example.com'),
      passwordHash: null,
      role: 'USER',
    })
    await links.replaceForUser({ userId: pedro.id, tokenHash: 'hash:old', expiresAt: NOW })
  })

  it('issues a new link for a Pending user and drops the previous one', async () => {
    const result = await issueLink.execute({ actor: superAdmin, userId: pedro.id })

    expect(result.activationToken).toBe('token-1')
    expect(result.expiresAt).toEqual(new Date('2026-09-28T13:00:00.000Z'))
    expect(links.all().map((l) => l.tokenHash)).toEqual(['hash:token-1'])
  })

  it('refuses an actor who is not the Super admin with FORBIDDEN', async () => {
    await expect(issueLink.execute({ actor: pedro, userId: pedro.id })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND for an unknown User', async () => {
    await expect(issueLink.execute({ actor: superAdmin, userId: 999 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('refuses a User who already set a password with USER_ALREADY_ACTIVE', async () => {
    await expect(issueLink.execute({ actor: superAdmin, userId: superAdmin.id })).rejects.toEqual(
      new AppError('USER_ALREADY_ACTIVE'),
    )
  })
})
