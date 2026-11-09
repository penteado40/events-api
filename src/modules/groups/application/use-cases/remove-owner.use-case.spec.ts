import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { RemoveOwnerUseCase } from './remove-owner.use-case.js'

describe('RemoveOwnerUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let rosters: InMemoryGroupRosterRepository
  let unitOfWork: InMemoryUnitOfWork
  let removeOwner: RemoveOwnerUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    unitOfWork = new InMemoryUnitOfWork()
    removeOwner = new RemoveOwnerUseCase(rosters, members, unitOfWork)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
  })

  it('lets the Super admin take an Owner out while another Owner stays, under the lock', async () => {
    members.add({ groupId: 1, userId: 3, role: 'OWNER' })

    await removeOwner.execute({ actor: SUPER_ADMIN, groupId: 1, userId: ANA.id })

    expect(members.all()).toEqual([{ groupId: 1, userId: 3, role: 'OWNER' }])
    expect(rosters.locks()).toEqual([1])
    expect(unitOfWork.runs()).toBe(1)
  })

  it('refuses to take out the last Owner with LAST_OWNER', async () => {
    members.add({ groupId: 1, userId: 3, role: 'VIEWER' })

    await expect(
      removeOwner.execute({ actor: SUPER_ADMIN, groupId: 1, userId: ANA.id }),
    ).rejects.toEqual(new AppError('LAST_OWNER'))
    expect(members.ofGroup(1)).toHaveLength(2)
  })

  it('answers NOT_FOUND for a Viewer: this route takes only Owners', async () => {
    members.add({ groupId: 1, userId: 3, role: 'VIEWER' })

    await expect(
      removeOwner.execute({ actor: SUPER_ADMIN, groupId: 1, userId: 3 }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('refuses an Owner taking out another Owner with FORBIDDEN (ADR-0017)', async () => {
    members.add({ groupId: 1, userId: 3, role: 'OWNER' })

    await expect(removeOwner.execute({ actor: ANA, groupId: 1, userId: 3 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(members.ofGroup(1)).toHaveLength(2)
    expect(rosters.locks()).toEqual([])
  })

  it('answers NOT_FOUND to a User who is not a Group member, and for a missing Group', async () => {
    const caio = { id: 9, isSuperAdmin: false }

    await expect(removeOwner.execute({ actor: caio, groupId: 1, userId: ANA.id })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(
      removeOwner.execute({ actor: SUPER_ADMIN, groupId: 42, userId: ANA.id }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })
})
