import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { LeaveGroupUseCase } from './leave-group.use-case.js'

const BIA = { id: 3, isSuperAdmin: false }

describe('LeaveGroupUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let rosters: InMemoryGroupRosterRepository
  let leave: LeaveGroupUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    leave = new LeaveGroupUseCase(rosters, members, new InMemoryUnitOfWork())
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
  })

  it('lets an Owner leave the Group while another Owner stays, under the lock', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'OWNER' })

    await leave.execute({ actor: ANA, groupId: 1 })

    expect(members.ofGroup(1)).toEqual([{ groupId: 1, userId: BIA.id, role: 'OWNER' }])
    expect(rosters.locks()).toEqual([1])
  })

  it('refuses the last Owner with LAST_OWNER', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'VIEWER' })

    await expect(leave.execute({ actor: ANA, groupId: 1 })).rejects.toEqual(
      new AppError('LAST_OWNER'),
    )
    expect(members.ofGroup(1)).toHaveLength(2)
  })

  it('lets only one of two Owners leaving at the same time go', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'OWNER' })

    const results = await Promise.allSettled([
      leave.execute({ actor: ANA, groupId: 1 }),
      leave.execute({ actor: BIA, groupId: 1 }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: new AppError('LAST_OWNER'),
    })
    expect(members.ofGroup(1).map((m) => m.role)).toEqual(['OWNER'])
  })

  it('refuses a Viewer with FORBIDDEN: only an Owner removes them (ADR-0017)', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'VIEWER' })

    await expect(leave.execute({ actor: BIA, groupId: 1 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(rosters.locks()).toEqual([])
  })

  it('refuses the Super admin with FORBIDDEN: they are never a Group member', async () => {
    await expect(leave.execute({ actor: SUPER_ADMIN, groupId: 1 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND to a User who is not a Group member', async () => {
    await expect(leave.execute({ actor: BIA, groupId: 1 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('refuses with FORBIDDEN an Owner demoted between the check and the lock', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'OWNER' })
    const demoteAnaFirst = new LeaveGroupUseCase(
      rosters,
      {
        findByUser: async (userId: number) => {
          const found = await members.findByUser(userId)
          members.update({ groupId: 1, userId: ANA.id, role: 'VIEWER' }, SCRIPT_STAMP)
          return found
        },
        findByGroup: (groupId: number) => members.findByGroup(groupId),
      },
      new InMemoryUnitOfWork(),
    )

    await expect(demoteAnaFirst.execute({ actor: ANA, groupId: 1 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(members.ofGroup(1)).toHaveLength(2)
  })
})
