import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { DemoteOwnerUseCase } from './demote-owner.use-case.js'

const NOW = new Date('2026-11-02T12:00:00.000Z')

describe('DemoteOwnerUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let rosters: InMemoryGroupRosterRepository
  let demoteOwner: DemoteOwnerUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    demoteOwner = new DemoteOwnerUseCase(
      rosters,
      members,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
  })

  it('lets the Super admin make an Owner a Viewer, as the Author, under the lock', async () => {
    members.add({ groupId: 1, userId: 3, role: 'OWNER' })

    const member = await demoteOwner.execute({ actor: SUPER_ADMIN, groupId: 1, userId: ANA.id })

    expect(member).toEqual({ groupId: 1, userId: ANA.id, role: 'VIEWER' })
    expect(members.ofGroup(1)).toEqual([
      { groupId: 1, userId: ANA.id, role: 'VIEWER' },
      { groupId: 1, userId: 3, role: 'OWNER' },
    ])
    expect(members.stampOf(1, ANA.id)).toEqual({ by: SUPER_ADMIN.id, at: NOW })
    expect(rosters.locks()).toEqual([1])
  })

  it('refuses to demote the last Owner with LAST_OWNER', async () => {
    await expect(
      demoteOwner.execute({ actor: SUPER_ADMIN, groupId: 1, userId: ANA.id }),
    ).rejects.toEqual(new AppError('LAST_OWNER'))
    expect(members.ofGroup(1)).toEqual([{ groupId: 1, userId: ANA.id, role: 'OWNER' }])
  })

  it('refuses an Owner demoting another Owner with FORBIDDEN (ADR-0017)', async () => {
    members.add({ groupId: 1, userId: 3, role: 'OWNER' })

    await expect(demoteOwner.execute({ actor: ANA, groupId: 1, userId: 3 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(rosters.locks()).toEqual([])
  })

  it('answers NOT_FOUND for someone who is not an Owner of the Group', async () => {
    await expect(
      demoteOwner.execute({ actor: SUPER_ADMIN, groupId: 1, userId: 99 }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })
})
