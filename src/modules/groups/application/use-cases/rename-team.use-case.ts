import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { TeamName } from '../../domain/team-name.vo.js'
import type { Team } from '../../domain/team.entity.js'
import type { TeamRepository } from '../../domain/team.repository.js'
import type { ActingUser } from '../actor.js'
import { requireTeamsManager } from '../team-access.js'

export interface RenameTeamInput {
  actor: ActingUser
  groupId: number
  teamId: number
  name: string
}

export type RenameTeamOutput = Team

/** An Owner of the Group, or the Super admin, renames a Team. A name another Team of the Group has is TEAM_NAME_TAKEN. */
export class RenameTeamUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RenameTeamInput): Promise<RenameTeamOutput> {
    await requireTeamsManager(input.actor, input.groupId, {
      groups: this.groups,
      members: this.members,
    })
    const team = await this.teams.findInGroup(input.groupId, input.teamId)
    if (!team) throw new AppError('NOT_FOUND')

    team.rename(TeamName.create(input.name), { by: input.actor.id, at: this.clock.now() })
    await this.teams.save(team)
    return team
  }
}
