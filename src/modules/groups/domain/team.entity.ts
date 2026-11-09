import type { Stamp } from '../../../shared/domain/stamp.js'
import type { TeamName } from './team-name.vo.js'

export interface TeamProps {
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

/**
 * A named shortcut of a Group, kept by its Owners (Cantores, Banda, Técnica).
 * Only a name for now; no rule beyond the name being unique in the Group,
 * which the repository enforces (docs/arquitetura.md §6).
 */
export class Team {
  private constructor(private readonly props: TeamProps) {}

  static restore(props: TeamProps): Team {
    return new Team({ ...props })
  }

  get id(): number {
    return this.props.id
  }
  get groupId(): number {
    return this.props.groupId
  }
  get name(): string {
    return this.props.name
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
  get createdById(): number | null {
    return this.props.createdById
  }
  get updatedById(): number | null {
    return this.props.updatedById
  }

  rename(name: TeamName, stamp: Stamp): void {
    this.props.name = name.value
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}
