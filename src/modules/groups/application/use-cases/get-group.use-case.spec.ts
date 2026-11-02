import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { GetGroupUseCase } from './get-group.use-case.js'

describe('GetGroupUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let getGroup: GetGroupUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    getGroup = new GetGroupUseCase(groups, members)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
  })

  it('shows any Group to the Super admin', async () => {
    const group = await getGroup.execute({ actor: SUPER_ADMIN, groupId: 1 })

    expect(group.name).toBe('Vocal Livre')
  })

  it.each(['OWNER', 'VIEWER'] as const)('shows the Group to its %s', async (role) => {
    members.add({ groupId: 1, userId: ANA.id, role })

    const group = await getGroup.execute({ actor: ANA, groupId: 1 })

    expect(group.id).toBe(1)
  })

  it('answers NOT_FOUND to a User who is not a Group member of the Group', async () => {
    members.add({ groupId: 2, userId: ANA.id, role: 'OWNER' })

    await expect(getGroup.execute({ actor: ANA, groupId: 1 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('answers NOT_FOUND for a Group that does not exist', async () => {
    await expect(getGroup.execute({ actor: SUPER_ADMIN, groupId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
