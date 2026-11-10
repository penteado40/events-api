import { beforeEach, describe, expect, it } from 'vitest'
import { groupMemberRemoved } from '../../domain/events/group-member-removed.event.js'
import { FakeGroupUserAccounts } from '../testing/fake-group-user-accounts.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { OnGroupMemberRemovedHandler } from './on-group-member-removed.handler.js'

const NOW = new Date('2026-11-09T12:00:00.000Z')

describe('OnGroupMemberRemovedHandler', () => {
  let members: InMemoryGroupMemberRepository
  let accounts: FakeGroupUserAccounts
  let handler: OnGroupMemberRemovedHandler

  beforeEach(() => {
    members = new InMemoryGroupMemberRepository()
    accounts = new FakeGroupUserAccounts(NOW)
    handler = new OnGroupMemberRemovedHandler(members, accounts)
  })

  it('revokes the Activation link of a user left with no Group member', async () => {
    const lia = accounts.existing({ email: 'lia@x.com', name: 'Lia', isPending: true })

    await handler.handle(groupMemberRemoved(1, lia.id, NOW))

    expect(accounts.dropped()).toEqual([lia.id])
  })

  it('keeps the link of a user who is still a Viewer elsewhere', async () => {
    const lia = accounts.existing({ email: 'lia@x.com', name: 'Lia', isPending: true })
    members.add({ groupId: 2, userId: lia.id, role: 'VIEWER' })

    await handler.handle(groupMemberRemoved(1, lia.id, NOW))

    expect(accounts.dropped()).toEqual([])
  })

  it('keeps the link of a user who is an Owner elsewhere', async () => {
    const lia = accounts.existing({ email: 'lia@x.com', name: 'Lia', isPending: true })
    members.add({ groupId: 2, userId: lia.id, role: 'OWNER' })

    await handler.handle(groupMemberRemoved(1, lia.id, NOW))

    expect(accounts.dropped()).toEqual([])
  })

  it('lets a failing revocation reach the publisher, which logs it', async () => {
    const lia = accounts.existing({ email: 'lia@x.com', name: 'Lia', isPending: true })
    accounts.failNextDrop()

    await expect(handler.handle(groupMemberRemoved(1, lia.id, NOW))).rejects.toThrow('drop failed')
  })
})
