import { type GroupMembership, Memberships } from '../ports/memberships.js'

/** Memberships arranged per User id; a User with none arranged has none. */
export class InMemoryMemberships extends Memberships {
  private readonly byUser = new Map<number, GroupMembership[]>()
  readonly asked: number[] = []

  set(userId: number, memberships: GroupMembership[]): void {
    this.byUser.set(userId, memberships)
  }

  async of(userId: number): Promise<GroupMembership[]> {
    this.asked.push(userId)
    return this.byUser.get(userId) ?? []
  }
}
