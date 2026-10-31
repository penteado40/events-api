import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { FakeInvitationIssuer } from '../testing/fake-invitation-issuer.js'
import { SCRIPT_STAMP, signedIn, PHONE } from '../testing/identity-fixtures.js'
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
    links = new InMemoryActivationLinkRepository()
    const clock = new FixedClock(NOW)
    issueLink = new IssueActivationLinkUseCase(
      users,
      links,
      new FakeInvitationIssuer(clock, 1),
      clock,
    )
    superAdmin = await signedIn(
      users,
      await users.create(
        {
          name: 'Admin',
          email: Email.create('admin@example.com'),
          phone: PHONE,
          role: 'SUPER_ADMIN',
        },
        SCRIPT_STAMP,
      ),
    )
    pedro = await users.create(
      {
        name: 'Pedro',
        email: Email.create('pedro@example.com'),
        phone: PHONE,
        role: 'USER',
      },
      SCRIPT_STAMP,
    )
    await links.replaceForUser(
      { userId: pedro.id, invitationId: 'inv_old', expiresAt: NOW },
      SCRIPT_STAMP,
    )
  })

  it('issues a new link for a Pending user, replacing the stored one', async () => {
    const result = await issueLink.execute({ actor: superAdmin, userId: pedro.id })

    expect(result).toEqual({
      url: 'https://accounts.clerk.test/accept?invitation=inv_1',
      expiresAt: new Date('2026-09-29T12:00:00.000Z'),
    })
    expect(links.all().map((l) => l.invitationId)).toEqual(['inv_1'])
  })

  it('records the Super admin as the Author of the new link', async () => {
    await issueLink.execute({ actor: superAdmin, userId: pedro.id })

    expect(links.all()[0]?.createdById).toBe(1)
    expect(links.all()[0]?.createdAt).toEqual(NOW)
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

  it('refuses a User who already signed in with USER_ALREADY_ACTIVE', async () => {
    await expect(issueLink.execute({ actor: superAdmin, userId: superAdmin.id })).rejects.toEqual(
      new AppError('USER_ALREADY_ACTIVE'),
    )
  })
})
