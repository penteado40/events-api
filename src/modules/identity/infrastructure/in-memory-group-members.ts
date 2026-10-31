import type { GroupMember } from '../domain/group-member.js'
import { GroupMembers } from '../application/ports/group-members.js'

/**
 * No Groups exist yet, so nobody is a Group member. PROJ-168, PROJ-172 and
 * PROJ-177 replace it with an `in-process-` read of the Group members.
 */
export class InMemoryGroupMembers extends GroupMembers {
  async ofUser(): Promise<GroupMember[]> {
    return []
  }
}
