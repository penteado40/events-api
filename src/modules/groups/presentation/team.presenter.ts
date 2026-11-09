import type { Team } from '../domain/team.entity.js'
import type { TeamJson } from './dto/team.dto.js'

export const TeamPresenter = {
  toJson(team: Team): TeamJson {
    return {
      id: team.id,
      groupId: team.groupId,
      name: team.name,
      createdAt: team.createdAt.toISOString(),
    }
  },
}
