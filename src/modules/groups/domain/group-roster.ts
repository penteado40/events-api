import { AppError } from '../../../shared/domain/app-error.js'
import { AggregateRoot } from '../../../shared/domain/domain-event.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { groupMemberRemoved } from './events/group-member-removed.event.js'
import type { GroupMember, GroupRole } from './group-member.js'

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
  /** Group members whose role changed, with their new role. */
  roleChanges: { member: GroupMember; stamp: Stamp }[]
  /** User ids of the Group members taken out of the Group. */
  removed: number[]
  /** The write that gave the Group its first Owner, if it happened now. */
  firstOwner: Stamp | null
}

/**
 * The Group members of one Group: an aggregate rooted in the Group, so the
 * rules that look at every member at once (one tie per User, the last Owner)
 * live in a single place. The rules judge only what was read, so the writes
 * of a Group are serialized (ADR-0014): the roster is read under the Group's
 * lock.
 */
export class GroupRoster extends AggregateRoot {
  private readonly added: GroupRosterChanges['added'] = []
  private readonly roleChanges: GroupRosterChanges['roleChanges'] = []
  private readonly removed: number[] = []
  private firstOwner: Stamp | null = null

  private constructor(private readonly props: GroupRosterProps) {
    super()
  }

  static restore(props: GroupRosterProps): GroupRoster {
    return new GroupRoster({ ...props, members: props.members.map((m) => ({ ...m })) })
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

  /** The role of the User in the Group, or null when they are not a Group member. */
  roleOf(userId: number): GroupRole | null {
    return this.find(userId)?.role ?? null
  }

  /** Gives the User the role of Owner in the Group, as a new Group member. */
  addOwner(candidate: GroupMemberCandidate, stamp: Stamp): GroupMember {
    const member = this.addMember(candidate, 'OWNER', stamp)
    this.markOwnerGiven(stamp)
    return member
  }

  /** Gives the User the role of Viewer in the Group, as a new Group member. */
  addViewer(candidate: GroupMemberCandidate, stamp: Stamp): GroupMember {
    return this.addMember(candidate, 'VIEWER', stamp)
  }

  /**
   * Takes an Owner out of the Group, unless they are the last one (LAST_OWNER).
   * No Stamp: the tie is deleted, so no row is left to carry the Author.
   */
  removeOwner(userId: number): void {
    this.ownerToLose(userId)
    this.dropMember(userId)
  }

  /**
   * Takes a Viewer out of the Group and records GroupMemberRemoved; an Owner or
   * a stranger is NOT_FOUND (an Owner leaves by the Owner routes, ADR-0017).
   */
  removeViewer(userId: number, at: Date): void {
    if (this.find(userId)?.role !== 'VIEWER') throw new AppError('NOT_FOUND')
    this.dropMember(userId)
    this.record(groupMemberRemoved(this.props.groupId, userId, at))
  }

  /** Makes an Owner a Viewer, unless they are the last Owner (LAST_OWNER). */
  demoteOwner(userId: number, stamp: Stamp): GroupMember {
    const member = this.ownerToLose(userId)
    return this.changeRole(member, 'VIEWER', stamp)
  }

  /** An Owner leaves the Group on their own: a Viewer does not (FORBIDDEN), nor the last Owner. */
  leave(userId: number): void {
    this.assertSelfOwner(userId)
    this.removeOwner(userId)
  }

  /** An Owner makes themselves a Viewer: a Viewer gets FORBIDDEN, the last Owner LAST_OWNER. */
  demoteSelf(userId: number, stamp: Stamp): GroupMember {
    this.assertSelfOwner(userId)
    return this.demoteOwner(userId, stamp)
  }

  /** Makes a Viewer an Owner; an Owner stays as they are. */
  promoteToOwner(userId: number, stamp: Stamp): GroupMember {
    const member = this.find(userId)
    if (!member) throw new AppError('NOT_FOUND')
    if (member.role === 'OWNER') return { ...member }
    const promoted = this.changeRole(member, 'OWNER', stamp)
    this.markOwnerGiven(stamp)
    return promoted
  }

  changes(): GroupRosterChanges {
    return {
      added: [...this.added],
      roleChanges: [...this.roleChanges],
      removed: [...this.removed],
      firstOwner: this.firstOwner,
    }
  }

  /**
   * Who steps down must still be an Owner in this Roster: the AccessPolicy judged
   * a Membership read before the Group's lock, which may have changed since.
   */
  private assertSelfOwner(userId: number): void {
    const role = this.roleOf(userId)
    if (role === null) throw new AppError('NOT_FOUND')
    if (role !== 'OWNER') throw new AppError('FORBIDDEN')
  }

  private addMember(candidate: GroupMemberCandidate, role: GroupRole, stamp: Stamp): GroupMember {
    if (candidate.isSuperAdmin) throw new AppError('SUPER_ADMIN_NOT_A_GROUP_MEMBER')
    if (this.find(candidate.userId)) throw new AppError('ALREADY_A_GROUP_MEMBER')
    const member: GroupMember = { groupId: this.props.groupId, userId: candidate.userId, role }
    this.props.members.push(member)
    this.added.push({ member: { ...member }, stamp })
    return { ...member }
  }

  private dropMember(userId: number): void {
    this.props.members = this.props.members.filter((m) => m.userId !== userId)
    this.removed.push(userId)
  }

  private find(userId: number): GroupMember | undefined {
    return this.props.members.find((m) => m.userId === userId)
  }

  /** The Owner who is about to stop being one; a Group that has had an Owner keeps at least one. */
  private ownerToLose(userId: number): GroupMember {
    const member = this.find(userId)
    if (member?.role !== 'OWNER') throw new AppError('NOT_FOUND')
    const owners = this.props.members.filter((m) => m.role === 'OWNER').length
    if (owners === 1) throw new AppError('LAST_OWNER')
    return member
  }

  private changeRole(member: GroupMember, role: GroupRole, stamp: Stamp): GroupMember {
    member.role = role
    this.roleChanges.push({ member: { ...member }, stamp })
    return { ...member }
  }

  private markOwnerGiven(stamp: Stamp): void {
    if (this.props.hasHadOwner) return
    this.props.hasHadOwner = true
    this.firstOwner = stamp
  }
}
