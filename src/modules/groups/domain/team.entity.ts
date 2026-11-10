import type { TeamName } from './team-name.vo.js'

/**
 * A named shortcut of a Group, kept by its Owners (Cantores, Banda, Técnica).
 * Only a name for now; no rule beyond the name being unique in the Group,
 * which the repository enforces. So it is a plain type, not a rich entity
 * (docs/arquitetura.md §6).
 */
export interface Team {
  id: number
  groupId: number
  name: string
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewTeamProps {
  groupId: number
  name: TeamName
}
