import { AppError } from '../../../../shared/domain/app-error.js'
import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import type { NewTeamProps, Team } from '../../domain/team.entity.js'
import { TeamRepository } from '../../domain/team.repository.js'

export class InMemoryTeamRepository extends TeamRepository {
  private readonly teams = new Map<number, Team>()
  private nextId = 1

  async findInGroup(groupId: number, id: number): Promise<Team | null> {
    const team = this.teams.get(id)
    return team && team.groupId === groupId ? team : null
  }

  async findByGroup(groupId: number): Promise<Team[]> {
    return [...this.teams.values()]
      .filter((t) => t.groupId === groupId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  }

  async create(props: NewTeamProps, stamp: Stamp): Promise<Team> {
    this.assertNameFree(props.groupId, props.name.value, null)
    const team: Team = {
      id: this.nextId++,
      groupId: props.groupId,
      name: props.name.value,
      ...createdWith(stamp),
    }
    this.teams.set(team.id, team)
    return team
  }

  async save(team: Team): Promise<void> {
    this.assertNameFree(team.groupId, team.name, team.id)
    this.teams.set(team.id, team)
  }

  async delete(id: number): Promise<void> {
    this.teams.delete(id)
  }

  private assertNameFree(groupId: number, name: string, exceptId: number | null): void {
    // Case-insensitive, as the database index on (groupId, lower(name)).
    const key = name.toLowerCase()
    const taken = [...this.teams.values()].some(
      (t) => t.groupId === groupId && t.name.toLowerCase() === key && t.id !== exceptId,
    )
    if (taken) throw new AppError('TEAM_NAME_TAKEN')
  }
}
