import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { FakeGroupMailer } from '../testing/fake-group-mailer.js'
import { FakeGroupUserAccounts } from '../testing/fake-group-user-accounts.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { AddOwnerUseCase } from './add-owner.use-case.js'

const NOW = new Date('2026-10-31T12:00:00.000Z')
const ADMIN = { email: 'admin@x.com' }
const JOAO = { email: 'joao@x.com', name: 'João', phone: '+5521987654321' }

describe('AddOwnerUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let accounts: FakeGroupUserAccounts
  let mailer: FakeGroupMailer
  let rosters: InMemoryGroupRosterRepository
  let addOwner: AddOwnerUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    accounts = new FakeGroupUserAccounts(NOW)
    mailer = new FakeGroupMailer()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    addOwner = new AddOwnerUseCase(
      rosters,
      groups,
      members,
      accounts,
      mailer,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
  })

  it('makes an existing User an Owner of the Group, with no Activation link', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })

    const result = await addOwner.execute({
      actor: SUPER_ADMIN,
      inviter: ADMIN,
      groupId: 1,
      ...JOAO,
    })

    expect(result).toEqual({
      member: { groupId: 1, userId: joao.id, role: 'OWNER' },
      user: joao,
      activationLink: null,
    })
    expect(members.all()).toEqual([{ groupId: 1, userId: joao.id, role: 'OWNER' }])
    expect(members.stampOf(1, joao.id)).toEqual({ by: SUPER_ADMIN.id, at: NOW })
  })

  it('writes the Owner under the lock of the Group, judging the Roster read there', async () => {
    accounts.existing({ email: 'joao@x.com', name: 'João' })

    await addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO })

    expect(rosters.locks()).toEqual([1])
  })

  it('tells identity which Group the new Pending user is being added to', async () => {
    await addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO })

    expect(accounts.ensureContacts()).toEqual([
      expect.objectContaining({ email: JOAO.email, group: 'Vocal Livre' }),
    ])
  })

  it('creates a Pending user for a new email and returns their Activation link', async () => {
    const result = await addOwner.execute({
      actor: SUPER_ADMIN,
      inviter: ADMIN,
      groupId: 1,
      ...JOAO,
    })

    expect(result.user).toMatchObject({ email: 'joao@x.com', isPending: true })
    expect(result.activationLink).toEqual({
      url: 'https://accounts.clerk.test/accept?invitation=1',
      expiresAt: new Date('2026-11-07T12:00:00.000Z'),
    })
    expect(accounts.ensureStamps()).toEqual([{ by: SUPER_ADMIN.id, at: NOW }])
    expect(members.all()).toEqual([{ groupId: 1, userId: result.user.id, role: 'OWNER' }])
  })

  it('marks the Group as having had an Owner, by the Super admin', async () => {
    await addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO })

    const group = await groups.findById(1)
    expect(group?.hasHadOwner).toBe(true)
    expect(group?.updatedById).toBe(SUPER_ADMIN.id)
    expect(group?.updatedAt).toEqual(NOW)
  })

  it('lets a Group have more than one Owner', async () => {
    const bia = accounts.existing({ email: 'bia@x.com', name: 'Bia' })
    members.add({ groupId: 1, userId: bia.id, role: 'OWNER' })

    await addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO })

    expect(members.all().map((m) => m.role)).toEqual(['OWNER', 'OWNER'])
  })

  it('refuses who is already a Group member of the Group with ALREADY_A_GROUP_MEMBER', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
    members.add({ groupId: 1, userId: joao.id, role: 'VIEWER' })

    await expect(
      addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO }),
    ).rejects.toEqual(new AppError('ALREADY_A_GROUP_MEMBER'))
    expect(members.all()).toEqual([{ groupId: 1, userId: joao.id, role: 'VIEWER' }])
  })

  it('refuses the Super admin as an Owner with SUPER_ADMIN_NOT_A_GROUP_MEMBER', async () => {
    accounts.existing({ email: 'admin@x.com', name: 'Admin', isSuperAdmin: true })

    await expect(
      addOwner.execute({
        actor: SUPER_ADMIN,
        inviter: ADMIN,
        groupId: 1,
        ...JOAO,
        email: 'admin@x.com',
      }),
    ).rejects.toEqual(new AppError('SUPER_ADMIN_NOT_A_GROUP_MEMBER'))
    expect(members.all()).toEqual([])
    expect((await groups.findById(1))?.hasHadOwner).toBe(false)
  })

  it('refuses an Owner of the Group with FORBIDDEN: only the Super admin sets Owners', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

    await expect(
      addOwner.execute({ actor: ANA, inviter: ADMIN, groupId: 1, ...JOAO }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(accounts.ensureStamps()).toEqual([])
  })

  it('answers NOT_FOUND to a User who is not a Group member of the Group', async () => {
    await expect(
      addOwner.execute({ actor: ANA, inviter: ADMIN, groupId: 1, ...JOAO }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    expect(accounts.ensureStamps()).toEqual([])
  })

  it('answers NOT_FOUND for a Group that does not exist', async () => {
    await expect(
      addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 42, ...JOAO }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    expect(accounts.ensureStamps()).toEqual([])
  })

  it("revokes the new Pending user's Activation link when storing the Owner fails", async () => {
    members.failNextInsert()

    await expect(
      addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO }),
    ).rejects.toThrow()
    const [created] = accounts.created()
    expect(accounts.dropped()).toEqual([created?.id])
  })

  it("leaves an existing User's link alone when storing the Owner fails", async () => {
    accounts.existing({ email: 'joao@x.com', name: 'João', isPending: true })
    members.failNextInsert()

    await expect(
      addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO }),
    ).rejects.toThrow()
    expect(accounts.dropped()).toEqual([])
  })

  it('fails naming the User whose link stayed open when revoking it fails too', async () => {
    members.failNextInsert()
    accounts.failNextDrop()

    await expect(
      addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO }),
    ).rejects.toThrow(/User 10\b/)
  })

  describe('emails', () => {
    it("emails only the Group's Activation link to a Pending user created now", async () => {
      const result = await addOwner.execute({
        actor: SUPER_ADMIN,
        inviter: ADMIN,
        groupId: 1,
        ...JOAO,
      })

      expect(mailer.sent).toEqual([
        {
          kind: 'GROUP_ACTIVATION_LINK',
          group: { name: 'Vocal Livre' },
          to: { email: 'joao@x.com', name: 'João' },
          link: result.activationLink,
          inviter: ADMIN,
          stamp: { by: SUPER_ADMIN.id, at: NOW },
        },
      ])
    })

    it('emails only the Group access to a User who is already active', async () => {
      accounts.existing({ email: 'joao@x.com', name: 'João' })

      await addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO })

      expect(mailer.sent).toEqual([
        {
          kind: 'GROUP_ACCESS',
          group: { name: 'Vocal Livre' },
          to: { email: 'joao@x.com', name: 'João' },
          link: null,
          inviter: ADMIN,
          stamp: { by: SUPER_ADMIN.id, at: NOW },
        },
      ])
    })

    it('emails the Group access to a Pending user who already had a link: there is no new link', async () => {
      accounts.existing({ email: 'joao@x.com', name: 'João', isPending: true })

      await addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO })

      expect(mailer.sent.map((e) => e.kind)).toEqual(['GROUP_ACCESS'])
    })

    it('emails nobody when the Owner is not stored', async () => {
      members.failNextInsert()

      await expect(
        addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO }),
      ).rejects.toThrow()

      expect(mailer.sent).toEqual([])
    })

    it('emails nobody when the User is already a Group member', async () => {
      const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
      members.add({ groupId: 1, userId: joao.id, role: 'VIEWER' })

      await expect(
        addOwner.execute({ actor: SUPER_ADMIN, inviter: ADMIN, groupId: 1, ...JOAO }),
      ).rejects.toEqual(new AppError('ALREADY_A_GROUP_MEMBER'))

      expect(mailer.sent).toEqual([])
    })

    it('emails nobody when the actor may not set Owners', async () => {
      members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

      await expect(
        addOwner.execute({ actor: ANA, inviter: { email: 'ana@x.com' }, groupId: 1, ...JOAO }),
      ).rejects.toEqual(new AppError('FORBIDDEN'))

      expect(mailer.sent).toEqual([])
    })
  })
})
