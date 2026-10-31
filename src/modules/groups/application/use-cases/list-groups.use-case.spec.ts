import { beforeEach, describe, expect, it } from 'vitest'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { ListGroupsUseCase } from './list-groups.use-case.js'

describe('ListGroupsUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let listGroups: ListGroupsUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    listGroups = new ListGroupsUseCase(groups, members)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Coral Alegria') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Banda Norte') }, SCRIPT_STAMP)
  })

  it('lists every Group to the Super admin, by name', async () => {
    const result = await listGroups.execute({ actor: SUPER_ADMIN })

    expect(result.map((g) => g.name)).toEqual(['Banda Norte', 'Coral Alegria', 'Vocal Livre'])
  })

  it('lists to a User only the Groups they are a Group member of, whatever the role', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })
    members.add({ groupId: 3, userId: ANA.id, role: 'OWNER' })
    members.add({ groupId: 2, userId: 99, role: 'OWNER' })

    const result = await listGroups.execute({ actor: ANA })

    expect(result.map((g) => g.name)).toEqual(['Banda Norte', 'Vocal Livre'])
  })

  it('lists nothing to a User who is in no Group', async () => {
    expect(await listGroups.execute({ actor: ANA })).toEqual([])
  })
})
