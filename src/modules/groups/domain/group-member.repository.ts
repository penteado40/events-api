import type { GroupMember } from './group-member.js'

/** Reads a User's Group members, for their Membership. The writes go through the GroupRoster. */
export abstract class GroupMemberRepository {
  /** Every Group member of the User, one per Group. */
  abstract findByUser(userId: number): Promise<GroupMember[]>
  /** Every Group member of the Group, in the order they joined. */
  abstract findByGroup(groupId: number): Promise<GroupMember[]>
  /**
   * Every Group member of the Group, in the order they joined, read under the
   * Group's lock (ADR-0014), the same one a roster write takes, held until the
   * running UnitOfWork ends: whoever else takes it waits, in arrival order.
   * Only inside a UnitOfWork, where the lock holds.
   */
  abstract lockByGroup(groupId: number): Promise<GroupMember[]>
}
