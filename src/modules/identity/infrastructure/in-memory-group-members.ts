import type { GroupMember } from '../domain/group-member.js'
import { GroupMembers } from '../application/ports/group-members.js'

/**
 * Nobody is a Group member yet: no route writes Group members (PROJ-172,
 * PROJ-177). PROJ-178 replaces it with a read of the groups context.
 */
export class InMemoryGroupMembers extends GroupMembers {
  async ofUser(): Promise<GroupMember[]> {
    return []
  }
}
