import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { GroupMember } from './group-member.js'

export interface GroupRosterProps {
  groupId: number
  /** Once true, the Group never goes without an Owner again (ADR-0017). */
  hasHadOwner: boolean
  members: GroupMember[]
}

/** The User to be made a Group member, as the roster needs to judge them. */
export interface GroupMemberCandidate {
  userId: number
  isSuperAdmin: boolean
}

/** What changed since the roster was read, for the repository to write in one go. */
export interface GroupRosterChanges {
  added: { member: GroupMember; stamp: Stamp }[]
  /** The write that gave the Group its first Owner, if it happened now. */
  firstOwner: Stamp | null
}

/**
 * The Group members of one Group: an aggregate rooted in the Group, so the
 * rules that look at every member at once (one tie per User, the last Owner)
 * live in a single place.
 */
export class GroupRoster {
  private readonly added: GroupRosterChanges['added'] = []
  private firstOwner: Stamp | null = null

  private constructor(private readonly props: GroupRosterProps) {}

  static restore(props: GroupRosterProps): GroupRoster {
    return new GroupRoster({ ...props, members: [...props.members] })
  }

  get groupId(): number {
    return this.props.groupId
  }
  get hasHadOwner(): boolean {
    return this.props.hasHadOwner
  }
  get members(): readonly GroupMember[] {
    return this.props.members
  }

  /** Gives the User the role of Owner in the Group, as a new Group member. */
  addOwner(candidate: GroupMemberCandidate, stamp: Stamp): GroupMember {
    if (candidate.isSuperAdmin) throw new AppError('SUPER_ADMIN_NOT_A_GROUP_MEMBER')
    if (this.props.members.some((m) => m.userId === candidate.userId)) {
      throw new AppError('ALREADY_A_GROUP_MEMBER')
    }
    const member: GroupMember = {
      groupId: this.props.groupId,
      userId: candidate.userId,
      role: 'OWNER',
    }
    this.props.members.push(member)
    this.added.push({ member, stamp })
    if (!this.props.hasHadOwner) {
      this.props.hasHadOwner = true
      this.firstOwner = stamp
    }
    return member
  }

  changes(): GroupRosterChanges {
    return { added: [...this.added], firstOwner: this.firstOwner }
  }
}
