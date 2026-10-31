import type { Stamp } from '../../../shared/domain/stamp.js'

export interface GroupProps {
  id: number
  name: string
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewGroupProps {
  name: string
}

/**
 * The tenant of the platform: an artistic group with its people and its
 * production. Born with a name and no Group members, until the Super admin
 * sets the first Owner.
 */
export class Group {
  private constructor(private readonly props: GroupProps) {}

  static restore(props: GroupProps): Group {
    return new Group({ ...props })
  }

  get id(): number {
    return this.props.id
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

  rename(name: string, stamp: Stamp): void {
    this.props.name = name.trim()
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}
