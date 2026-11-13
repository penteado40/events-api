import { beforeEach, describe, expect, it } from 'vitest'
import { GroupName } from '../domain/group-name.vo.js'
import { GroupLookup } from './group-lookup.js'
import { ANA, SCRIPT_STAMP } from './testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from './testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from './testing/in-memory-group.repository.js'

describe('GroupLookup', () => {
  let members: InMemoryGroupMemberRepository
  let lookup: GroupLookup

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    lookup = new GroupLookup(groups, members)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Coral') }, SCRIPT_STAMP)
  })

  it('tells whether a Group exists', async () => {
    expect(await lookup.exists(1)).toBe(true)
    expect(await lookup.exists(42)).toBe(false)
  })

  it('gives the role of the User in that Group only', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })
    members.add({ groupId: 2, userId: ANA.id, role: 'OWNER' })

    expect(await lookup.roleIn(1, ANA.id)).toBe('VIEWER')
    expect(await lookup.roleIn(2, ANA.id)).toBe('OWNER')
  })

  it('gives null to who is not a Group member of the Group', async () => {
    members.add({ groupId: 2, userId: ANA.id, role: 'OWNER' })

    expect(await lookup.roleIn(1, ANA.id)).toBeNull()
  })
})
