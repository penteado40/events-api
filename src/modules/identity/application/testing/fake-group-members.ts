import type { GroupMember } from '../../domain/group-member.js'
import { GroupMembers } from '../ports/group-members.js'

/** Group members arranged per User id; a User with none arranged is in no Group. */
export class FakeGroupMembers extends GroupMembers {
  private readonly byUser = new Map<number, GroupMember[]>()

  set(userId: number, groups: GroupMember[]): void {
    this.byUser.set(userId, groups)
  }

  async ofUser(userId: number): Promise<GroupMember[]> {
    return this.byUser.get(userId) ?? []
  }
}
