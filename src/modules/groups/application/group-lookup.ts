import type { GroupRole } from '../domain/group-member.js'
import type { GroupMemberRepository } from '../domain/group-member.repository.js'
import type { GroupRepository } from '../domain/group.repository.js'

/**
 * Read-only queries the groups context offers other contexts about a Group:
 * whether it exists and the role a User has in it. events reaches it through
 * its GroupDirectory port; who may do what stays with the caller.
 */
export class GroupLookup {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
  ) {}

  async exists(groupId: number): Promise<boolean> {
    return (await this.groups.findById(groupId)) !== null
  }

  /** The User's role in the Group; null when they are not a Group member of it. */
  async roleIn(groupId: number, userId: number): Promise<GroupRole | null> {
    // A User is a Group member of a handful of Groups: reading them all is cheap.
    const member = (await this.members.findByUser(userId)).find((m) => m.groupId === groupId)
    return member?.role ?? null
  }

  /**
   * The ids of every Group member of the Group (Owners and Viewers), in the
   * order they joined, holding the Group's lock (the one roster writes take)
   * until the running UnitOfWork ends (ADR-0014). Only inside a UnitOfWork.
   */
  async lockMemberIds(groupId: number): Promise<number[]> {
    return (await this.members.lockByGroup(groupId)).map((m) => m.userId)
  }
}
