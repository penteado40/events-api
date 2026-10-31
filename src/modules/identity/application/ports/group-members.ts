import type { GroupMember } from '../../domain/group-member.js'

/**
 * Reads the Groups a User is a Group member of. Until PROJ-178 reads them from
 * the groups context, nobody is one.
 */
export abstract class GroupMembers {
  abstract ofUser(userId: number): Promise<GroupMember[]>
}
