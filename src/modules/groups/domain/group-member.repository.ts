import type { GroupMember } from './group-member.js'

/** Reads the Group members. The writes arrive with the Owners and the Viewers (PROJ-172, PROJ-177). */
export abstract class GroupMemberRepository {
  /** Every Group member of the User, one per Group. */
  abstract findByUser(userId: number): Promise<GroupMember[]>
}
