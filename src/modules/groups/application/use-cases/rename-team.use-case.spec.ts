import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { TeamName } from '../../domain/team-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryTeamRepository } from '../testing/in-memory-team.repository.js'
import { RenameTeamUseCase } from './rename-team.use-case.js'

const NOW = new Date('2026-11-09T12:00:00.000Z')

describe('RenameTeamUseCase', () => {
  let members: InMemoryGroupMemberRepository
  let teams: InMemoryTeamRepository
  let renameTeam: RenameTeamUseCase

  beforeEach(async () => {
    const groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    teams = new InMemoryTeamRepository()
    renameTeam = new RenameTeamUseCase(groups, members, teams, new FixedClock(NOW))
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    await groups.create({ name: GroupName.create('Outro') }, SCRIPT_STAMP)
    await teams.create({ groupId: 1, name: TeamName.create('Banda') }, SCRIPT_STAMP)
    await teams.create({ groupId: 1, name: TeamName.create('Técnica') }, SCRIPT_STAMP)
    await teams.create({ groupId: 2, name: TeamName.create('Cantores') }, SCRIPT_STAMP)
  })

  it('lets an Owner rename a Team, recording them as the Author', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

    const team = await renameTeam.execute({ actor: ANA, groupId: 1, teamId: 1, name: ' Músicos ' })

    expect(team).toMatchObject({ name: 'Músicos', updatedById: ANA.id, createdById: null })
    expect(team.updatedAt).toEqual(NOW)
    expect((await teams.findInGroup(1, 1))?.name).toBe('Músicos')
  })

  it('lets the Super admin rename a Team', async () => {
    const team = await renameTeam.execute({
      actor: SUPER_ADMIN,
      groupId: 1,
      teamId: 1,
      name: 'Músicos',
    })

    expect(team.updatedById).toBe(SUPER_ADMIN.id)
  })

  it('refuses a Viewer with FORBIDDEN, keeping the name', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })

    await expect(
      renameTeam.execute({ actor: ANA, groupId: 1, teamId: 1, name: 'Músicos' }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect((await teams.findInGroup(1, 1))?.name).toBe('Banda')
  })

  it('answers NOT_FOUND to who is not a Group member', async () => {
    await expect(
      renameTeam.execute({ actor: ANA, groupId: 1, teamId: 1, name: 'Músicos' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('answers NOT_FOUND for a Team that does not exist or belongs to another Group', async () => {
    await expect(
      renameTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 42, name: 'Músicos' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    await expect(
      renameTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 3, name: 'Músicos' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('refuses a name another Team of the Group has with TEAM_NAME_TAKEN', async () => {
    await expect(
      renameTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 1, name: 'Técnica' }),
    ).rejects.toEqual(new AppError('TEAM_NAME_TAKEN'))
  })

  it('refuses a name another Team of the Group has in another casing with TEAM_NAME_TAKEN', async () => {
    await expect(
      renameTeam.execute({ actor: SUPER_ADMIN, groupId: 1, teamId: 1, name: ' tÉcnica' }),
    ).rejects.toEqual(new AppError('TEAM_NAME_TAKEN'))
  })

  it('lets a Team change the casing of its own name, keeping the new casing', async () => {
    const team = await renameTeam.execute({
      actor: SUPER_ADMIN,
      groupId: 1,
      teamId: 1,
      name: 'BANDA',
    })

    expect(team.name).toBe('BANDA')
    expect((await teams.findInGroup(1, 1))?.name).toBe('BANDA')
  })

  it('accepts the Team keeping its own name', async () => {
    const team = await renameTeam.execute({
      actor: SUPER_ADMIN,
      groupId: 1,
      teamId: 1,
      name: 'Banda',
    })

    expect(team.name).toBe('Banda')
  })
})
