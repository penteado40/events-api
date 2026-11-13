import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { TeamName } from '../../domain/team-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryTeamRepository } from '../testing/in-memory-team.repository.js'
import { ListTeamsUseCase } from './list-teams.use-case.js'

describe('ListTeamsUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let listTeams: ListTeamsUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    const teams = new InMemoryTeamRepository()
    members = new InMemoryGroupMemberRepository()
    listTeams = new ListTeamsUseCase(groups, members, teams)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Outro') }, SCRIPT_STAMP)
    await teams.create({ groupId: 1, name: TeamName.create('Técnica') }, SCRIPT_STAMP)
    await teams.create({ groupId: 1, name: TeamName.create('Banda') }, SCRIPT_STAMP)
    await teams.create({ groupId: 2, name: TeamName.create('Cantores') }, SCRIPT_STAMP)
  })

  it('lists the Teams of the Group by name to a Viewer', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })

    const teams = await listTeams.execute({ actor: ANA, groupId: 1 })

    expect(teams.map((t) => t.name)).toEqual(['Banda', 'Técnica'])
  })

  it('lists them to an Owner and to the Super admin', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

    expect(await listTeams.execute({ actor: ANA, groupId: 1 })).toHaveLength(2)
    expect(await listTeams.execute({ actor: SUPER_ADMIN, groupId: 1 })).toHaveLength(2)
  })

  it('answers NOT_FOUND to who is not a Group member, and for a Group that does not exist', async () => {
    members.add({ groupId: 2, userId: ANA.id, role: 'OWNER' })

    await expect(listTeams.execute({ actor: ANA, groupId: 1 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(listTeams.execute({ actor: SUPER_ADMIN, groupId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
