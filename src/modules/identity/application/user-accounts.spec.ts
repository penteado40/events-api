import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { Email } from '../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { FakeActivationTokenGenerator } from './testing/fake-activation-token-generator.js'
import { SCRIPT_STAMP } from './testing/identity-fixtures.js'
import { InMemoryActivationLinkRepository } from './testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from './testing/in-memory-user.repository.js'
import { UserAccounts } from './user-accounts.js'

const NOW = new Date('2026-09-29T12:00:00.000Z')
const OWNER_STAMP: Stamp = { by: 10, at: NOW }
const SEVEN_DAYS = 7 * 24 * 60 * 60

describe('UserAccounts', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let accounts: UserAccounts

  beforeEach(() => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository(users)
    accounts = new UserAccounts(users, links, new FakeActivationTokenGenerator(), {
      ttlSeconds: SEVEN_DAYS,
    })
  })

  async function existing(email: string, passwordHash: string | null = 'hashed:x') {
    return users.create(
      { name: 'Existing', email: Email.create(email), passwordHash, role: 'USER' },
      SCRIPT_STAMP,
    )
  }

  describe('findOrCreatePending', () => {
    it('creates a Pending user with an Activation link when the email is new', async () => {
      const result = await accounts.findOrCreatePending(
        { email: ' Joao@X.com ', name: ' João ' },
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
        activation: {
          activationToken: 'token-1',
          expiresAt: new Date('2026-10-06T12:00:00.000Z'),
        },
      })
      const [stored] = users.all()
      expect(stored?.createdById).toBe(10)
      expect(links.all().map((l) => l.createdById)).toEqual([10])
    })

    it('only finds an existing User, leaving them and their link untouched', async () => {
      const joao = await existing('joao@x.com', null)
      await links.replaceForUser(
        { userId: joao.id, tokenHash: 'hash:ana-link', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      const result = await accounts.findOrCreatePending(
        { email: 'joao@x.com', name: 'Outro nome' },
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
        activation: null,
      })
      expect(links.all().map((l) => l.tokenHash)).toEqual(['hash:ana-link'])
      expect((await users.findById(joao.id))?.updatedById).toBeNull()
    })

    it('refuses an invalid email', async () => {
      await expect(
        accounts.findOrCreatePending({ email: 'not-an-email', name: 'X' }, OWNER_STAMP),
      ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    })
  })

  describe('reissueActivationLink', () => {
    it('issues a new link for a Pending user, dropping the previous one', async () => {
      const joao = await existing('joao@x.com', null)
      await links.replaceForUser(
        { userId: joao.id, tokenHash: 'hash:old', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      const link = await accounts.reissueActivationLink(joao.id, OWNER_STAMP)

      expect(link.activationToken).toBe('token-1')
      expect(links.all().map((l) => [l.tokenHash, l.createdById])).toEqual([['hash:token-1', 10]])
    })

    it('refuses an active User', async () => {
      const ana = await existing('ana@x.com')
      await expect(accounts.reissueActivationLink(ana.id, OWNER_STAMP)).rejects.toEqual(
        new AppError('USER_ALREADY_ACTIVE'),
      )
    })
  })

  describe('dropPendingActivation', () => {
    it("drops a Pending user's Activation link", async () => {
      const joao = await existing('joao@x.com', null)
      await links.replaceForUser(
        { userId: joao.id, tokenHash: 'hash:link', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      await accounts.dropPendingActivation(joao.id)

      expect(links.all()).toEqual([])
    })

    it("keeps an active User's used link as history", async () => {
      const ana = await existing('ana@x.com')
      await links.replaceForUser(
        { userId: ana.id, tokenHash: 'hash:link', expiresAt: NOW },
        SCRIPT_STAMP,
      )

      await accounts.dropPendingActivation(ana.id)

      expect(links.all()).toHaveLength(1)
    })
  })
})
