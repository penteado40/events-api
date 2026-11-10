import { type GroupMember, GroupMembers } from '../../identity/index.js'
import type { GroupMemberRepository } from '../domain/group-member.repository.js'
import type { GroupRepository } from '../domain/group.repository.js'

/**
 * The Groups of a User, for identity's /me. identity declares the port
 * (GroupMembers) and groups, owner of the data, implements it here, so
 * identity never imports groups (docs/arquitetura.md §5.5).
 */
export class MembershipLookup extends GroupMembers {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
  ) {
    super()
  }

  /** The Groups the User is a Group member of, by Group name. */
  async ofUser(userId: number): Promise<GroupMember[]> {
    const roles = new Map((await this.members.findByUser(userId)).map((m) => [m.groupId, m.role]))
    const groups = await this.groups.findManyByIds([...roles.keys()])
    // The FKs (GroupMember.user Restrict, GroupMember.group Cascade) make a
    // persistent orphan impossible: a row without its Group only shows up in a
    // race with the Group's deletion, and skipping it is correct.
    return groups.flatMap((g) => {
      const role = roles.get(g.id)
      return role ? [{ groupId: g.id, groupName: g.name, role }] : []
    })
  }
}
