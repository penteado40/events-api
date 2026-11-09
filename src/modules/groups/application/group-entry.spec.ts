import { describe, expect, it } from 'vitest'
import { Group } from '../domain/group.entity.js'
import { dropLink, emailEntry } from './group-entry.js'
import { FakeGroupMailer } from './testing/fake-group-mailer.js'
import { FakeGroupUserAccounts } from './testing/fake-group-user-accounts.js'

const NOW = new Date('2026-11-02T12:00:00.000Z')
const STAMP = { by: 1, at: NOW }
const INVITER = { email: 'ana@x.com' }
const LINK = { url: 'https://accounts.clerk.test/accept?invitation=1', expiresAt: NOW }
const group = Group.restore({
  id: 1,
  name: 'Vocal Livre',
  hasHadOwner: false,
  createdAt: NOW,
  createdById: null,
  updatedAt: NOW,
  updatedById: null,
})
const user = (isPending: boolean) => ({
  id: 10,
  name: 'João',
  email: 'joao@x.com',
  isSuperAdmin: false,
  isPending,
})

describe('emailEntry', () => {
  it('sends the Activation link of the Group when a link was born now', () => {
    const mailer = new FakeGroupMailer()

    emailEntry(mailer, group, { user: user(true), activationLink: LINK }, INVITER, STAMP)

    expect(mailer.sent.map((e) => e.kind)).toEqual(['GROUP_ACTIVATION_LINK'])
  })

  it.each([false, true])(
    'sends the Group access when no link was born (pending: %s)',
    (pending) => {
      const mailer = new FakeGroupMailer()

      emailEntry(mailer, group, { user: user(pending), activationLink: null }, INVITER, STAMP)

      expect(mailer.sent.map((e) => e.kind)).toEqual(['GROUP_ACCESS'])
    },
  )
})

describe('dropLink', () => {
  it('revokes the Pending activation of the User', async () => {
    const accounts = new FakeGroupUserAccounts(NOW)

    await dropLink(accounts, 10, 'VIEWER', new Error('boom'))

    expect(accounts.dropped()).toEqual([10])
  })

  it('fails naming the User and the role when the revoke fails too', async () => {
    const accounts = new FakeGroupUserAccounts(NOW)
    accounts.failNextDrop()

    await expect(dropLink(accounts, 10, 'OWNER', new Error('boom'))).rejects.toThrow(
      /Owner falhou.*User 10\b/,
    )
  })
})
