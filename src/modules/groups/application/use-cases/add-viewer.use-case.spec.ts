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
import { AddViewerUseCase } from './add-viewer.use-case.js'

const NOW = new Date('2026-11-02T12:00:00.000Z')
const ANA_INVITER = { email: 'ana@x.com' }
const JOAO = { email: 'joao@x.com', name: 'João', phone: '+5521987654321' }

describe('AddViewerUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let accounts: FakeGroupUserAccounts
  let mailer: FakeGroupMailer
  let rosters: InMemoryGroupRosterRepository
  let addViewer: AddViewerUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    accounts = new FakeGroupUserAccounts(NOW)
    mailer = new FakeGroupMailer()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    addViewer = new AddViewerUseCase(
      rosters,
      groups,
      members,
      accounts,
      mailer,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
  })

  it('creates a Pending user for a new email, a Viewer tie and the Activation link', async () => {
    const result = await addViewer.execute({
      actor: ANA,
      inviter: ANA_INVITER,
      groupId: 1,
      ...JOAO,
    })

    expect(result.user).toMatchObject({ email: 'joao@x.com', isPending: true })
    expect(result.member).toEqual({ groupId: 1, userId: result.user.id, role: 'VIEWER' })
    expect(result.activationLink).toEqual({
      url: 'https://accounts.clerk.test/accept?invitation=1',
      expiresAt: new Date('2026-11-09T12:00:00.000Z'),
    })
    expect(members.stampOf(1, result.user.id)).toEqual({ by: ANA.id, at: NOW })
    expect(accounts.ensureStamps()).toEqual([{ by: ANA.id, at: NOW }])
  })

  it('makes an active User a Viewer with no Activation link', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })

    const result = await addViewer.execute({
      actor: ANA,
      inviter: ANA_INVITER,
      groupId: 1,
      ...JOAO,
    })

    expect(result).toEqual({
      member: { groupId: 1, userId: joao.id, role: 'VIEWER' },
      user: joao,
      activationLink: null,
    })
  })

  it('lets the Super admin add a Viewer to any Group', async () => {
    const result = await addViewer.execute({
      actor: SUPER_ADMIN,
      inviter: { email: 'admin@x.com' },
      groupId: 1,
      ...JOAO,
    })

    expect(result.member.role).toBe('VIEWER')
  })

  it('writes under the lock of the Group', async () => {
    await addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO })

    expect(rosters.locks()).toEqual([1])
  })

  it('does not mark the Group as having had an Owner', async () => {
    await addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO })

    expect((await groups.findById(1))?.hasHadOwner).toBe(false)
  })

  it('refuses who is already a Group member with ALREADY_A_GROUP_MEMBER', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
    members.add({ groupId: 1, userId: joao.id, role: 'OWNER' })

    await expect(
      addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO }),
    ).rejects.toEqual(new AppError('ALREADY_A_GROUP_MEMBER'))
    expect(members.all().filter((m) => m.userId === joao.id)).toEqual([
      { groupId: 1, userId: joao.id, role: 'OWNER' },
    ])
  })

  it('refuses the Super admin as a Viewer with SUPER_ADMIN_NOT_A_GROUP_MEMBER', async () => {
    accounts.existing({ email: 'admin@x.com', name: 'Admin', isSuperAdmin: true })

    await expect(
      addViewer.execute({
        actor: ANA,
        inviter: ANA_INVITER,
        groupId: 1,
        ...JOAO,
        email: 'admin@x.com',
      }),
    ).rejects.toEqual(new AppError('SUPER_ADMIN_NOT_A_GROUP_MEMBER'))
  })

  it('refuses a Viewer with FORBIDDEN, creating no User', async () => {
    const bia = { id: 3, isSuperAdmin: false }
    members.add({ groupId: 1, userId: bia.id, role: 'VIEWER' })

    await expect(
      addViewer.execute({ actor: bia, inviter: { email: 'bia@x.com' }, groupId: 1, ...JOAO }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(accounts.ensureStamps()).toEqual([])
  })

  it('answers NOT_FOUND to who is not a Group member of the Group', async () => {
    const eva = { id: 4, isSuperAdmin: false }

    await expect(
      addViewer.execute({ actor: eva, inviter: { email: 'eva@x.com' }, groupId: 1, ...JOAO }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    expect(accounts.ensureStamps()).toEqual([])
  })

  it('answers NOT_FOUND for a Group that does not exist', async () => {
    await expect(
      addViewer.execute({ actor: SUPER_ADMIN, inviter: ANA_INVITER, groupId: 42, ...JOAO }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it("revokes the new Pending user's Activation link when storing the Viewer fails", async () => {
    members.failNextInsert()

    await expect(
      addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO }),
    ).rejects.toThrow()
    const [created] = accounts.created()
    expect(accounts.dropped()).toEqual([created?.id])
    expect(mailer.sent).toEqual([])
  })

  it('fails naming the User whose link stayed open when revoking it fails too', async () => {
    members.failNextInsert()
    accounts.failNextDrop()

    await expect(
      addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO }),
    ).rejects.toThrow(/User 10\b/)
  })

  describe('emails', () => {
    it("emails only the Group's Activation link to a Pending user created now, replying to the Owner", async () => {
      const result = await addViewer.execute({
        actor: ANA,
        inviter: ANA_INVITER,
        groupId: 1,
        ...JOAO,
      })

      expect(mailer.sent).toEqual([
        {
          kind: 'GROUP_ACTIVATION_LINK',
          group: { name: 'Vocal Livre' },
          to: { email: 'joao@x.com', name: 'João' },
          link: result.activationLink,
          inviter: ANA_INVITER,
          stamp: { by: ANA.id, at: NOW },
        },
      ])
    })

    it('emails only the Group access to a User who is already active', async () => {
      accounts.existing({ email: 'joao@x.com', name: 'João' })

      await addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO })

      expect(mailer.sent).toEqual([
        {
          kind: 'GROUP_ACCESS',
          group: { name: 'Vocal Livre' },
          to: { email: 'joao@x.com', name: 'João' },
          link: null,
          inviter: ANA_INVITER,
          stamp: { by: ANA.id, at: NOW },
        },
      ])
    })

    it('emails nobody about a Pending user who already had a link', async () => {
      accounts.existing({ email: 'joao@x.com', name: 'João', isPending: true })

      await addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO })

      expect(mailer.sent).toEqual([])
    })

    it('emails nobody when the User is already a Group member or the actor may not add', async () => {
      const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
      members.add({ groupId: 1, userId: joao.id, role: 'VIEWER' })
      await expect(
        addViewer.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, ...JOAO }),
      ).rejects.toThrow()

      members.add({ groupId: 1, userId: 3, role: 'VIEWER' })
      await expect(
        addViewer.execute({
          actor: { id: 3, isSuperAdmin: false },
          inviter: { email: 'bia@x.com' },
          groupId: 1,
          ...JOAO,
        }),
      ).rejects.toThrow()

      expect(mailer.sent).toEqual([])
    })
  })
})
