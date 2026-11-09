import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryTeamRepository } from '../testing/in-memory-team.repository.js'
import { CreateTeamUseCase } from './create-team.use-case.js'

const NOW = new Date('2026-11-09T12:00:00.000Z')

describe('CreateTeamUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let teams: InMemoryTeamRepository
  let createTeam: CreateTeamUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    teams = new InMemoryTeamRepository()
    createTeam = new CreateTeamUseCase(groups, members, teams, new FixedClock(NOW))
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
  })

  it('lets an Owner create a Team with the trimmed name, recording them as the Author', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })

    const team = await createTeam.execute({ actor: ANA, groupId: 1, name: ' Banda ' })

    expect(team).toMatchObject({
      groupId: 1,
      name: 'Banda',
      createdById: ANA.id,
      updatedById: ANA.id,
    })
    expect(team.createdAt).toEqual(NOW)
    expect(await teams.findByGroup(1)).toHaveLength(1)
  })

  it('lets the Super admin create a Team in any Group', async () => {
    const team = await createTeam.execute({ actor: SUPER_ADMIN, groupId: 1, name: 'Banda' })

    expect(team.createdById).toBe(SUPER_ADMIN.id)
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    members.add({ groupId: 1, userId: ANA.id, role: 'VIEWER' })

    await expect(createTeam.execute({ actor: ANA, groupId: 1, name: 'Banda' })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(await teams.findByGroup(1)).toEqual([])
  })

  it('answers NOT_FOUND to who is not a Group member, and for a Group that does not exist', async () => {
    await expect(createTeam.execute({ actor: ANA, groupId: 1, name: 'Banda' })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(
      createTeam.execute({ actor: SUPER_ADMIN, groupId: 42, name: 'Banda' }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('refuses a name the Group already has with TEAM_NAME_TAKEN', async () => {
    await createTeam.execute({ actor: SUPER_ADMIN, groupId: 1, name: 'Banda' })

    await expect(
      createTeam.execute({ actor: SUPER_ADMIN, groupId: 1, name: ' Banda ' }),
    ).rejects.toEqual(new AppError('TEAM_NAME_TAKEN'))
  })

  it('allows the same name in another Group', async () => {
    await groups.create({ name: GroupName.create('Outro') }, SCRIPT_STAMP)
    await createTeam.execute({ actor: SUPER_ADMIN, groupId: 1, name: 'Banda' })

    const team = await createTeam.execute({ actor: SUPER_ADMIN, groupId: 2, name: 'Banda' })

    expect(team.groupId).toBe(2)
  })

  it('refuses an empty name with VALIDATION_ERROR', async () => {
    await expect(
      createTeam.execute({ actor: SUPER_ADMIN, groupId: 1, name: '  ' }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })
})
