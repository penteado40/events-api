import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { DemoteSelfUseCase } from './demote-self.use-case.js'

const NOW = new Date('2026-11-02T12:00:00.000Z')
const BIA = { id: 3, isSuperAdmin: false }

describe('DemoteSelfUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let rosters: InMemoryGroupRosterRepository
  let demoteSelf: DemoteSelfUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    demoteSelf = new DemoteSelfUseCase(
      rosters,
      members,
      new InMemoryUnitOfWork(),
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
  })

  it('lets an Owner become a Viewer while another Owner stays, as the Author', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'OWNER' })

    const member = await demoteSelf.execute({ actor: ANA, groupId: 1 })

    expect(member).toEqual({ groupId: 1, userId: ANA.id, role: 'VIEWER' })
    expect(members.stampOf(1, ANA.id)).toEqual({ by: ANA.id, at: NOW })
    expect(rosters.locks()).toEqual([1])
  })

  it('refuses the last Owner with LAST_OWNER', async () => {
    await expect(demoteSelf.execute({ actor: ANA, groupId: 1 })).rejects.toEqual(
      new AppError('LAST_OWNER'),
    )
    expect(members.ofGroup(1)).toEqual([{ groupId: 1, userId: ANA.id, role: 'OWNER' }])
  })

  it('refuses a Viewer and the Super admin with FORBIDDEN', async () => {
    members.add({ groupId: 1, userId: BIA.id, role: 'VIEWER' })

    await expect(demoteSelf.execute({ actor: BIA, groupId: 1 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    await expect(demoteSelf.execute({ actor: SUPER_ADMIN, groupId: 1 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('answers NOT_FOUND to a User who is not a Group member', async () => {
    await expect(demoteSelf.execute({ actor: BIA, groupId: 1 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
