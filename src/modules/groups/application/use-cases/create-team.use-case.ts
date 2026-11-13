import type { Clock } from '../../../../shared/application/clock.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { TeamName } from '../../domain/team-name.vo.js'
import type { Team } from '../../domain/team.entity.js'
import type { TeamRepository } from '../../domain/team.repository.js'
import type { ActingUser } from '../actor.js'
import { requireTeamsManager } from '../team-access.js'

export interface CreateTeamInput {
  actor: ActingUser
  groupId: number
  name: string
}

export type CreateTeamOutput = Team

/** An Owner of the Group, or the Super admin, creates a Team. A name the Group already has is TEAM_NAME_TAKEN. */
export class CreateTeamUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTeamInput): Promise<CreateTeamOutput> {
    await requireTeamsManager(input.actor, input.groupId, {
      groups: this.groups,
      members: this.members,
    })
    return this.teams.create(
      { groupId: input.groupId, name: TeamName.create(input.name) },
      { by: input.actor.id, at: this.clock.now() },
    )
  }
}
