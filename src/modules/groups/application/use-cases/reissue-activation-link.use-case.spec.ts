import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { FakeGroupMailer } from '../testing/fake-group-mailer.js'
import { FakeGroupUserAccounts } from '../testing/fake-group-user-accounts.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { ReissueActivationLinkUseCase } from './reissue-activation-link.use-case.js'

const NOW = new Date('2026-11-02T12:00:00.000Z')
const ANA_INVITER = { email: 'ana@x.com' }

describe('ReissueActivationLinkUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let accounts: FakeGroupUserAccounts
  let mailer: FakeGroupMailer
  let reissue: ReissueActivationLinkUseCase
  let joaoId: number

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    accounts = new FakeGroupUserAccounts(NOW)
    mailer = new FakeGroupMailer()
    reissue = new ReissueActivationLinkUseCase(
      new InMemoryGroupRosterRepository(groups, members),
      groups,
      members,
      accounts,
      mailer,
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
    const { user } = await accounts.ensureUser(
      { email: 'joao@x.com', name: 'João', phone: '+5521987654321', group: 'Vocal Livre' },
      SCRIPT_STAMP,
    )
    joaoId = user.id
    members.add({ groupId: 1, userId: joaoId, role: 'VIEWER' })
  })

  it('issues a new link for a pending Viewer, by the actor, and emails it with replyTo', async () => {
    const result = await reissue.execute({
      actor: ANA,
      inviter: ANA_INVITER,
      groupId: 1,
      userId: joaoId,
    })

    expect(result.user).toMatchObject({ id: joaoId, email: 'joao@x.com', isPending: true })
    expect(result.activationLink).toEqual({
      url: 'https://accounts.clerk.test/accept?invitation=2',
      expiresAt: new Date('2026-11-09T12:00:00.000Z'),
    })
    expect(accounts.reissueStamps()).toEqual([{ by: ANA.id, at: NOW }])
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

  it('lets the Super admin do it in any Group, with replyTo on the Super admin', async () => {
    const result = await reissue.execute({
      actor: SUPER_ADMIN,
      inviter: { email: 'admin@x.com' },
      groupId: 1,
      userId: joaoId,
    })

    expect(result.user.id).toBe(joaoId)
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0]).toMatchObject({ inviter: { email: 'admin@x.com' } })
  })

  describe('for a pending Owner', () => {
    let caioId: number

    beforeEach(async () => {
      const { user } = await accounts.ensureUser(
        { email: 'caio@x.com', name: 'Caio', phone: '+5521912345678', group: 'Vocal Livre' },
        SCRIPT_STAMP,
      )
      caioId = user.id
      members.add({ groupId: 1, userId: caioId, role: 'OWNER' })
    })

    it('refuses an Owner with FORBIDDEN, touching no link', async () => {
      await expect(
        reissue.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, userId: caioId }),
      ).rejects.toEqual(new AppError('FORBIDDEN'))
      expect(accounts.reissueStamps()).toEqual([])
      expect(mailer.sent).toEqual([])
    })

    it('lets the Super admin do it', async () => {
      const result = await reissue.execute({
        actor: SUPER_ADMIN,
        inviter: { email: 'admin@x.com' },
        groupId: 1,
        userId: caioId,
      })

      expect(result.user).toMatchObject({ id: caioId, isPending: true })
      expect(mailer.sent).toHaveLength(1)
    })
  })

  it('refuses an active Group member with USER_ALREADY_ACTIVE, sending nothing', async () => {
    const bia = accounts.existing({ email: 'bia@x.com', name: 'Bia' })
    members.add({ groupId: 1, userId: bia.id, role: 'VIEWER' })

    await expect(
      reissue.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, userId: bia.id }),
    ).rejects.toEqual(new AppError('USER_ALREADY_ACTIVE'))
    expect(mailer.sent).toEqual([])
  })

  it('answers NOT_FOUND for a User who is not a Group member of the Group, touching no link', async () => {
    const bia = accounts.existing({ email: 'bia@x.com', name: 'Bia', isPending: true })

    await expect(
      reissue.execute({ actor: ANA, inviter: ANA_INVITER, groupId: 1, userId: bia.id }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    expect(accounts.reissueStamps()).toEqual([])
    expect(mailer.sent).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, touching no link', async () => {
    const bia = { id: 3, isSuperAdmin: false }
    members.add({ groupId: 1, userId: bia.id, role: 'VIEWER' })

    await expect(
      reissue.execute({
        actor: bia,
        inviter: { email: 'bia@x.com' },
        groupId: 1,
        userId: joaoId,
      }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(accounts.reissueStamps()).toEqual([])
  })

  it('answers NOT_FOUND to who is not a Group member of the Group', async () => {
    const eva = { id: 4, isSuperAdmin: false }

    await expect(
      reissue.execute({
        actor: eva,
        inviter: { email: 'eva@x.com' },
        groupId: 1,
        userId: joaoId,
      }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('answers NOT_FOUND for a Group that does not exist', async () => {
    await expect(
      reissue.execute({ actor: SUPER_ADMIN, inviter: ANA_INVITER, groupId: 99, userId: joaoId }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })
})
