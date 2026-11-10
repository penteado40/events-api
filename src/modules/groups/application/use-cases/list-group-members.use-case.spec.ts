import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { FakeGroupUsers } from '../testing/fake-group-users.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { ListGroupMembersUseCase } from './list-group-members.use-case.js'

const BIA = {
  id: 3,
  name: 'Bia',
  email: 'bia@local.test',
  phone: '+5511911111111',
  isPending: false,
}
const CAIO = {
  id: 4,
  name: 'Caio',
  email: 'caio@local.test',
  phone: '+5511922222222',
  isPending: true,
}
const ANA_USER = {
  id: ANA.id,
  name: 'Ana',
  email: 'ana@local.test',
  phone: '+5511933333333',
  isPending: false,
}

describe('ListGroupMembersUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let users: FakeGroupUsers
  let listMembers: ListGroupMembersUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    users = new FakeGroupUsers()
    listMembers = new ListGroupMembersUseCase(groups, members, users)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Outro') }, SCRIPT_STAMP)
    for (const user of [ANA_USER, BIA, CAIO]) users.add(user)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
    members.add({ groupId: 1, userId: BIA.id, role: 'VIEWER' })
    members.add({ groupId: 1, userId: CAIO.id, role: 'VIEWER' })
    members.add({ groupId: 2, userId: BIA.id, role: 'OWNER' })
  })

  it('lists the Group members of the Group with their role and contact, to the Super admin', async () => {
    const list = await listMembers.execute({ actor: SUPER_ADMIN, groupId: 1 })

    expect(list).toEqual([
      { member: { groupId: 1, userId: ANA.id, role: 'OWNER' }, user: ANA_USER },
      { member: { groupId: 1, userId: BIA.id, role: 'VIEWER' }, user: BIA },
      { member: { groupId: 1, userId: CAIO.id, role: 'VIEWER' }, user: CAIO },
    ])
  })

  it.each([
    ['OWNER', ANA.id],
    ['VIEWER', BIA.id],
  ] as const)('lists the Group members to a %s of the Group', async (_role, userId) => {
    const list = await listMembers.execute({
      actor: { id: userId, isSuperAdmin: false },
      groupId: 1,
    })

    expect(list.map((entry) => entry.user.id)).toEqual([ANA.id, BIA.id, CAIO.id])
  })

  it('answers NOT_FOUND to a User who is not a Group member of the Group', async () => {
    await expect(
      listMembers.execute({ actor: { id: 99, isSuperAdmin: false }, groupId: 1 }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('answers NOT_FOUND for a Group that does not exist', async () => {
    await expect(listMembers.execute({ actor: SUPER_ADMIN, groupId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
