import { AppError } from '../../../../shared/domain/app-error.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import type { TeamRepository } from '../../domain/team.repository.js'
import type { ActingUser } from '../actor.js'
import { requireTeamsManager } from '../team-access.js'

export interface DeleteTeamInput {
  actor: ActingUser
  groupId: number
  teamId: number
}

/** An Owner of the Group, or the Super admin, deletes a Team. */
export class DeleteTeamUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(input: DeleteTeamInput): Promise<void> {
    await requireTeamsManager(input.actor, input.groupId, {
      groups: this.groups,
      members: this.members,
    })
    const team = await this.teams.findInGroup(input.groupId, input.teamId)
    if (!team) throw new AppError('NOT_FOUND')
    await this.teams.delete(team.id)
  }
}
