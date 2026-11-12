import { beforeEach, describe, expect, it } from 'vitest'
import { GroupName } from '../domain/group-name.vo.js'
import { MembershipLookup } from './membership-lookup.js'
import { ANA, SCRIPT_STAMP } from './testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from './testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from './testing/in-memory-group.repository.js'

describe('MembershipLookup', () => {
  let members: InMemoryGroupMemberRepository
  let lookup: MembershipLookup

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    lookup = new MembershipLookup(groups, members)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Coral') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Outro') }, SCRIPT_STAMP)
  })

  it('gives the Groups of the User with the role in each, by Group name', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })
    members.add({ groupId: 2, userId: ANA.id, role: 'OWNER' })
    members.add({ groupId: 3, userId: 99, role: 'OWNER' })

    expect(await lookup.ofUser(ANA.id)).toEqual([
      { groupId: 2, groupName: 'Coral', role: 'OWNER' },
      { groupId: 1, groupName: 'Vocal Livre', role: 'VIEWER' },
    ])
  })

  it('gives nothing to a User who is no Group member', async () => {
    expect(await lookup.ofUser(ANA.id)).toEqual([])
  })
})
