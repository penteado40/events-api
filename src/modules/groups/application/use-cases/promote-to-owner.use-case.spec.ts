import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { PromoteToOwnerUseCase } from './promote-to-owner.use-case.js'

const NOW = new Date('2026-11-02T12:00:00.000Z')

describe('PromoteToOwnerUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let rosters: InMemoryGroupRosterRepository
  let promote: PromoteToOwnerUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    promote = new PromoteToOwnerUseCase(
      rosters,
      members,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
  })

  it('lets the Super admin make a Viewer an Owner, as the Author, under the lock', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
    members.add({ groupId: 1, userId: 3, role: 'VIEWER' })

    const member = await promote.execute({ actor: SUPER_ADMIN, groupId: 1, userId: 3 })

    expect(member).toEqual({ groupId: 1, userId: 3, role: 'OWNER' })
    expect(members.stampOf(1, 3)).toEqual({ by: SUPER_ADMIN.id, at: NOW })
    expect(rosters.locks()).toEqual([1])
  })

  it('gives a Group born without an Owner its first one', async () => {
    members.add({ groupId: 1, userId: 3, role: 'VIEWER' })

    await promote.execute({ actor: SUPER_ADMIN, groupId: 1, userId: 3 })

    const group = await groups.findById(1)
    expect(group?.hasHadOwner).toBe(true)
    expect(group?.updatedById).toBe(SUPER_ADMIN.id)
  })

  it('refuses an Owner promoting a Viewer with FORBIDDEN (ADR-0017)', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
    members.add({ groupId: 1, userId: 3, role: 'VIEWER' })

    await expect(promote.execute({ actor: ANA, groupId: 1, userId: 3 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(members.ofGroup(1).map((m) => m.role)).toEqual(['OWNER', 'VIEWER'])
  })

  it('answers NOT_FOUND for someone who is not a Group member', async () => {
    await expect(promote.execute({ actor: SUPER_ADMIN, groupId: 1, userId: 99 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
