import type { Stamp } from '../../../shared/domain/stamp.js'
import type { NewTeamProps, Team } from './team.entity.js'

export abstract class TeamRepository {
  /** The Team of that Group; null when it does not exist or belongs to another Group. */
  abstract findInGroup(groupId: number, id: number): Promise<Team | null>
  /** The Teams of the Group, by name. */
  abstract findByGroup(groupId: number): Promise<Team[]>
  /** Throws TEAM_NAME_TAKEN when the Group already has a Team with that name, ignoring case. */
  abstract create(props: NewTeamProps, stamp: Stamp): Promise<Team>
  /** Throws TEAM_NAME_TAKEN when the Group already has another Team with that name, ignoring case. */
  abstract save(team: Team): Promise<void>
  abstract delete(id: number): Promise<void>
}
