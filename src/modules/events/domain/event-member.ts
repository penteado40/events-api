import type { Stamp } from '../../../shared/domain/stamp.js'

export const EVENT_ROLES = ['OWNER', 'MANAGER', 'VIEWER'] as const
export type EventRole = (typeof EVENT_ROLES)[number]

/** A User's link to one Event. The Primary owner is always an Owner (ADR-0003). */
export interface Membership {
  role: EventRole
  isPrimaryOwner: boolean
}

export interface NewEventMemberProps {
  eventId: number
  userId: number
  role: EventRole
}

export interface EventMemberProps extends NewEventMemberProps {
  isPrimaryOwner: boolean
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

/**
 * The link between a User and an Event. Who may change it is the
 * MembershipRules' call; the entity only records the change and its Author.
 */
export class EventMember {
  private readonly loaded: Membership

  private constructor(private readonly props: EventMemberProps) {
    this.loaded = { role: props.role, isPrimaryOwner: props.isPrimaryOwner }
  }

  static restore(props: EventMemberProps): EventMember {
    return new EventMember({ ...props })
  }

  get eventId(): number {
    return this.props.eventId
  }
  get userId(): number {
    return this.props.userId
  }
  get role(): EventRole {
    return this.props.role
  }
  get isPrimaryOwner(): boolean {
    return this.props.isPrimaryOwner
  }
  get membership(): Membership {
    return { role: this.props.role, isPrimaryOwner: this.props.isPrimaryOwner }
  }
  /**
   * The Membership as it was read. A write only goes through if the stored
   * link still matches it, so a concurrent change is refused (ADR-0014).
   */
  get loadedMembership(): Membership {
    return { ...this.loaded }
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

  /** Returns false when the member already had the role (nothing to store). */
  changeRole(role: EventRole, stamp: Stamp): boolean {
    if (role === this.props.role) return false
    this.props.role = role
    this.touch(stamp)
    return true
  }

  becomePrimaryOwner(stamp: Stamp): void {
    this.props.isPrimaryOwner = true
    this.touch(stamp)
  }

  /** The former Primary owner stays on as an Owner organizador. */
  stepDownAsPrimaryOwner(stamp: Stamp): void {
    this.props.isPrimaryOwner = false
    this.touch(stamp)
  }

  private touch(stamp: Stamp): void {
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}
