import type { GroupMember } from './group-member.js'

/** Reads a User's Group members, for their Membership. The writes go through the GroupRoster. */
export abstract class GroupMemberRepository {
  /** Every Group member of the User, one per Group. */
  abstract findByUser(userId: number): Promise<GroupMember[]>
  /** Every Group member of the Group, in the order they joined. */
  abstract findByGroup(groupId: number): Promise<GroupMember[]>
  /**
   * Every Group member of the Group, in the order they joined, read under a
   * shared lock of the Group (ADR-0014) held until the running UnitOfWork ends:
   * a roster write waits for it, and other readers holding it do not. Only
   * inside a UnitOfWork, where the lock holds.
   */
  abstract lockByGroup(groupId: number): Promise<GroupMember[]>
}
