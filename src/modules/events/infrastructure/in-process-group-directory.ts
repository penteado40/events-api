import type { GroupLookup } from '../../groups/index.js'
import { GroupDirectory } from '../application/ports/group-directory.js'
import type { GroupMemberRole, GroupRole } from '../domain/event-access-policy.js'

/** The GroupDirectory port over the read-only queries groups offers other contexts. */
export class InProcessGroupDirectory extends GroupDirectory {
  constructor(private readonly lookup: GroupLookup) {
    super()
  }

  exists(groupId: number): Promise<boolean> {
    return this.lookup.exists(groupId)
  }

  roleIn(groupId: number, userId: number): Promise<GroupRole | null> {
    return this.lookup.roleIn(groupId, userId)
  }

  lockMembers(groupId: number): Promise<GroupMemberRole[]> {
    return this.lookup.lockMembers(groupId)
  }
}
