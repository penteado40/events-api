import { type GroupMemberUser, GroupUsers } from '../ports/group-users.js'

/** Users by id, arranged with `add`. */
export class FakeGroupUsers extends GroupUsers {
  private readonly users = new Map<number, GroupMemberUser>()

  async findManyByIds(ids: number[]): Promise<GroupMemberUser[]> {
    return ids.flatMap((id) => this.users.get(id) ?? [])
  }

  add(user: GroupMemberUser): void {
    this.users.set(user.id, user)
  }
}
