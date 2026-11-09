import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { TeamName } from '../../domain/team-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryTeamRepository } from '../testing/in-memory-team.repository.js'
import { DeleteTeamUseCase } from './delete-team.use-case.js'

describe('DeleteTeamUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let teams: InMemoryTeamRepository
  let deleteTeam: DeleteTeamUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    teams = new InMemoryTeamRepository()
    deleteTeam = new DeleteTeamUseCase(groups, members, teams)
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Outro') }, SCRIPT_STAMP)
    await teams.create({ groupId: 1, name: TeamName.create('Banda') }, SCRIPT_STAMP)
    await teams.create({ groupId: 2, name: TeamName.create('Cantores') }, SCRIPT_STAMP)
  })

  it('lets an Owner delete a Team', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

    await deleteTeam.execute({ actor: ANA, groupId: 1, teamId: 1 })

    expect(await teams.findByGroup(1)).toEqual([])
  })

  it('lets the Super admin delete a Team', async () => {
    await deleteTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 1 })

    expect(await teams.findByGroup(1)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, keeping the Team', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })

    await expect(deleteTeam.execute({ actor: ANA, groupId: 1, teamId: 1 })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(await teams.findByGroup(1)).toHaveLength(1)
  })

  it('answers NOT_FOUND to who is not a Group member', async () => {
    await expect(deleteTeam.execute({ actor: ANA, groupId: 1, teamId: 1 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })

  it('answers NOT_FOUND for a Team that does not exist or belongs to another Group', async () => {
    await expect(
      deleteTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 42 }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    await expect(deleteTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 2 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    expect(await teams.findByGroup(2)).toHaveLength(1)
  })
})
