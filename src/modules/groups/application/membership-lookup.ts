import type { GroupRole } from '../domain/group-member.js'
import type { GroupMemberRepository } from '../domain/group-member.repository.js'
import type { GroupRepository } from '../domain/group.repository.js'

/** A Group a User is a Group member of, with their role there. */
export interface UserMembership {
  groupId: number
  groupName: string
  role: GroupRole
}

/** Read-only query that the groups context exports to other contexts: the Groups of a User. */
export class MembershipLookup {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
  ) {}

  /** The Groups the User is a Group member of, by Group name. */
  async ofUser(userId: number): Promise<UserMembership[]> {
    const roles = new Map((await this.members.findByUser(userId)).map((m) => [m.groupId, m.role]))
    const groups = await this.groups.findManyByIds([...roles.keys()])
    return groups.flatMap((g) => {
      const role = roles.get(g.id)
      return role ? [{ groupId: g.id, groupName: g.name, role }] : []
    })
  }
}
