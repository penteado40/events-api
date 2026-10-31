import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { RenameGroupUseCase } from './rename-group.use-case.js'

const NOW = new Date('2026-10-31T12:00:00.000Z')

describe('RenameGroupUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let renameGroup: RenameGroupUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    renameGroup = new RenameGroupUseCase(groups, members, new FixedClock(NOW))
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
  })

  it('renames the Group with the trimmed name, recording the Super admin as the Author', async () => {
    const group = await renameGroup.execute({ actor: SUPER_ADMIN, groupId: 1, name: ' Vocal ' })

    expect(group.name).toBe('Vocal')
    expect(group.updatedById).toBe(1)
    expect(group.updatedAt).toEqual(NOW)
    expect(group.createdAt).toEqual(SCRIPT_STAMP.at)
    expect((await groups.findById(1))?.name).toBe('Vocal')
  })

  it('answers NOT_FOUND for a Group that does not exist', async () => {
    await expect(
      renameGroup.execute({ actor: SUPER_ADMIN, groupId: 42, name: 'Vocal' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('answers NOT_FOUND to a User who is not a Group member of the Group', async () => {
    members.add({ groupId: 2, userId: ANA.id, role: 'OWNER' })

    await expect(renameGroup.execute({ actor: ANA, groupId: 1, name: 'Vocal' })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('refuses an Owner of the Group with FORBIDDEN, keeping the name', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

    await expect(renameGroup.execute({ actor: ANA, groupId: 1, name: 'Vocal' })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect((await groups.findById(1))?.name).toBe('Vocal Livre')
  })
})
