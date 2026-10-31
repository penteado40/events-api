import type { GroupMember } from '../../domain/group-member.js'

/**
 * Reads the Groups a User is a Group member of. Until the Groups arrive
 * (PROJ-168, PROJ-172, PROJ-177) nobody is one.
 */
export abstract class GroupMembers {
  abstract ofUser(userId: number): Promise<GroupMember[]>
}
