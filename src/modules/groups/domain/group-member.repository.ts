import type { GroupMember } from './group-member.js'

/** Reads a User's Group members, for their Membership. The writes go through the GroupRoster. */
export abstract class GroupMemberRepository {
  /** Every Group member of the User, one per Group. */
  abstract findByUser(userId: number): Promise<GroupMember[]>
}
