import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import type { Team } from '../../domain/team.entity.js'
import type { TeamRepository } from '../../domain/team.repository.js'
import type { ActingUser } from '../actor.js'
import { requireTeamsReader } from '../team-access.js'

export interface ListTeamsInput {
  actor: ActingUser
  groupId: number
}

export type ListTeamsOutput = Team[]

/** The Super admin or any Group member sees the Teams of the Group, by name. */
export class ListTeamsUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(input: ListTeamsInput): Promise<ListTeamsOutput> {
    await requireTeamsReader(input.actor, input.groupId, {
      groups: this.groups,
      members: this.members,
    })
    return this.teams.findByGroup(input.groupId)
  }
}
