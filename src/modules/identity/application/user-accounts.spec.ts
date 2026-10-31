import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { Email } from '../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { FakeInvitationIssuer } from './testing/fake-invitation-issuer.js'
import { SCRIPT_STAMP, signedIn, PHONE } from './testing/identity-fixtures.js'
import { InMemoryActivationLinkRepository } from './testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from './testing/in-memory-user.repository.js'
import { UserAccounts } from './user-accounts.js'

const NOW = new Date('2026-09-29T12:00:00.000Z')
const OWNER_STAMP: Stamp = { by: 10, at: NOW }

describe('UserAccounts', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let invitations: FakeInvitationIssuer
  let accounts: UserAccounts

  beforeEach(() => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository()
    invitations = new FakeInvitationIssuer(new FixedClock(NOW))
    accounts = new UserAccounts(users, links, invitations)
  })

  async function existing(email: string, { active = true } = {}) {
    const user = await users.create(
      { name: 'Existing', email: Email.create(email), phone: PHONE, role: 'USER' },
      SCRIPT_STAMP,
    )
    return active ? signedIn(users, user) : user
  }

  describe('ensureUser', () => {
    it('creates a Pending user with an Activation link when the email is new', async () => {
      const result = await accounts.ensureUser(
        { email: ' Joao@X.com ', name: ' João ', phone: '+55 21 98765-4321' },
        OWNER_STAMP,
      )

      expect(result).toEqual({
        user: {
          id: 1,
          name: 'João',
          email: 'joao@x.com',
          isSuperAdmin: false,
          isPending: true,
        },
        activationLink: {
          url: 'https://accounts.clerk.test/accept?invitation=inv_1',
          expiresAt: new Date('2026-10-06T12:00:00.000Z'),
        },
      })
      const [stored] = users.all()
      expect(stored?.phone.value).toBe('+5521987654321')
      expect(stored?.createdById).toBe(10)
      expect(links.all().map((l) => [l.invitationId, l.createdById])).toEqual([['inv_1', 10]])
    })

    it('only finds an existing User, leaving them and their link untouched', async () => {
      const joao = await existing('joao@x.com', { active: false })
      await links.replaceForUser(
        { userId: joao.id, invitationId: 'inv_old', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      const result = await accounts.ensureUser(
        { email: 'joao@x.com', name: 'Outro nome', phone: '+5521987654321' },
        OWNER_STAMP,
      )

      expect(result).toEqual({
        user: {
          id: joao.id,
          name: 'Existing',
          email: 'joao@x.com',
          isSuperAdmin: false,
          isPending: true,
        },
        activationLink: null,
      })
      expect(links.all().map((l) => l.invitationId)).toEqual(['inv_old'])
      expect(invitations.open()).toEqual([])
      expect((await users.findById(joao.id))?.updatedById).toBeNull()
    })

    it('creates no User when the invitation fails', async () => {
      invitations.failNextIssue()

      await expect(
        accounts.ensureUser(
          { email: 'joao@x.com', name: 'João', phone: '+5521987654321' },
          OWNER_STAMP,
        ),
      ).rejects.toThrow()
      expect(users.all()).toHaveLength(0)
      expect(links.all()).toHaveLength(0)
    })

    it('revokes the invitation when storing the link fails', async () => {
      links.failNextReplace()

      await expect(
        accounts.ensureUser(
          { email: 'joao@x.com', name: 'João', phone: '+5521987654321' },
          OWNER_STAMP,
        ),
      ).rejects.toThrow()
      expect(invitations.open()).toEqual([])
      expect(invitations.revoked()).toEqual(['inv_1'])
    })

    it('finds the User another request created meanwhile, revoking its own invitation', async () => {
      users.createConcurrently({
        name: 'Winner',
        email: Email.create('joao@x.com'),
        phone: PHONE,
        role: 'USER',
      })

      const result = await accounts.ensureUser(
        { email: 'joao@x.com', name: 'João', phone: '+5521987654321' },
        OWNER_STAMP,
      )

      expect(result.user.name).toBe('Winner')
      expect(result.activationLink).toBeNull()
      expect(invitations.open()).toEqual([])
    })

    it('refuses an invalid email', async () => {
      await expect(
        accounts.ensureUser(
          { email: 'not-an-email', name: 'X', phone: '+5521987654321' },
          OWNER_STAMP,
        ),
      ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    })

    it('refuses an invalid phone for a new User, creating nothing', async () => {
      await expect(
        accounts.ensureUser(
          { email: 'joao@x.com', name: 'João', phone: '98765-4321' },
          OWNER_STAMP,
        ),
      ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
      expect(users.all()).toHaveLength(0)
      expect(invitations.open()).toEqual([])
    })
  })

  describe('reissueActivationLink', () => {
    it('issues a new link for a Pending user, replacing the stored one', async () => {
      const joao = await existing('joao@x.com', { active: false })
      await links.replaceForUser(
        { userId: joao.id, invitationId: 'inv_old', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      const link = await accounts.reissueActivationLink(joao.id, OWNER_STAMP)

      expect(link.url).toBe('https://accounts.clerk.test/accept?invitation=inv_1')
      expect(links.all().map((l) => [l.invitationId, l.createdById])).toEqual([['inv_1', 10]])
    })

    it('refuses an active User', async () => {
      const ana = await existing('ana@x.com')
      await expect(accounts.reissueActivationLink(ana.id, OWNER_STAMP)).rejects.toEqual(
        new AppError('USER_ALREADY_ACTIVE'),
      )
      expect(invitations.open()).toEqual([])
    })
  })

  describe('dropPendingActivation', () => {
    it("revokes and drops a Pending user's Activation link", async () => {
      const { user } = await accounts.ensureUser(
        { email: 'joao@x.com', name: 'João', phone: '+5521987654321' },
        OWNER_STAMP,
      )

      await accounts.dropPendingActivation(user.id)

      expect(links.all()).toEqual([])
      expect(invitations.revoked()).toEqual(['inv_1'])
    })

    it('does nothing for a Pending user without a link', async () => {
      const joao = await existing('joao@x.com', { active: false })

      await expect(accounts.dropPendingActivation(joao.id)).resolves.toBeUndefined()
    })

    it("keeps an active User's used link as history", async () => {
      const ana = await existing('ana@x.com')
      await links.replaceForUser(
        { userId: ana.id, invitationId: 'inv_used', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      await accounts.dropPendingActivation(ana.id)

      expect(links.all()).toHaveLength(1)
    })
  })
})
