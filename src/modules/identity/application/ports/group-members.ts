import type { GroupMember } from '../../domain/group-member.js'

/** Reads the Groups a User is a Group member of, from the groups context. */
export abstract class GroupMembers {
  abstract ofUser(userId: number): Promise<GroupMember[]>
}
