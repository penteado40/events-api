import type { GroupRole } from '../../domain/event-access-policy.js'
import { GroupDirectory } from '../ports/group-directory.js'

/** The Groups and Group members the test arranges, standing in for the groups context. */
export class FakeGroupDirectory extends GroupDirectory {
  private readonly groups = new Set<number>()
  private readonly roles = new Map<string, GroupRole>()

  addGroup(groupId: number): this {
    this.groups.add(groupId)
    return this
  }

  addMember(groupId: number, userId: number, role: GroupRole): this {
    this.groups.add(groupId)
    this.roles.set(`${groupId}:${userId}`, role)
    return this
  }

  async exists(groupId: number): Promise<boolean> {
    return this.groups.has(groupId)
  }

  async roleIn(groupId: number, userId: number): Promise<GroupRole | null> {
    return this.roles.get(`${groupId}:${userId}`) ?? null
  }
}
