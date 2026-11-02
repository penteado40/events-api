import type { GroupMember } from '../domain/group-member.js'
import { GroupMembers } from '../application/ports/group-members.js'

/**
 * Reads no Group members: the groups context writes them (Owners since
 * PROJ-172), and PROJ-178 replaces this with a read of it.
 */
export class InMemoryGroupMembers extends GroupMembers {
  async ofUser(): Promise<GroupMember[]> {
    return []
  }
}
