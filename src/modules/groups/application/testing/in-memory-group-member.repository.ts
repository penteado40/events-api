import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { GroupMember } from '../../domain/group-member.js'
import { GroupMemberRepository } from '../../domain/group-member.repository.js'

export class InMemoryGroupMemberRepository extends GroupMemberRepository {
  private readonly members: { member: GroupMember; stamp: Stamp | null }[] = []
  private failingInsert = false

  async findByUser(userId: number): Promise<GroupMember[]> {
    return this.all().filter((m) => m.userId === userId)
  }

  async findByGroup(groupId: number): Promise<GroupMember[]> {
    return this.ofGroup(groupId)
  }

  /** The in-memory unit of work already runs one unit at a time: no lock to take. */
  async lockByGroup(groupId: number): Promise<GroupMember[]> {
    return this.ofGroup(groupId)
  }

  /**
   * The Group members of the Group, in the order they were added. Synchronous
   * helper for test assertions; findByGroup is the port contract.
   */
  ofGroup(groupId: number): GroupMember[] {
    return this.all().filter((m) => m.groupId === groupId)
  }

  /** Arranges a Group member, with no Author. */
  add(member: GroupMember): void {
    this.members.push({ member, stamp: null })
  }

  /** Stores a Group member as the roster writes them; `failNextInsert` makes it throw once. */
  insert(member: GroupMember, stamp: Stamp): void {
    if (this.failingInsert) {
      this.failingInsert = false
      throw new Error('in-memory group members: insert failed')
    }
    this.members.push({ member, stamp })
  }

  /** Writes the new role of a Group member, as the roster writes it. */
  update(member: GroupMember, stamp: Stamp): void {
    const found = this.members.find(
      (m) => m.member.groupId === member.groupId && m.member.userId === member.userId,
    )
    if (!found) throw new Error('in-memory group members: update of a missing member')
    found.member = { ...member }
    found.stamp = stamp
  }

  remove(groupId: number, userId: number): void {
    const index = this.members.findIndex(
      (m) => m.member.groupId === groupId && m.member.userId === userId,
    )
    if (index >= 0) this.members.splice(index, 1)
  }

  failNextInsert(): void {
    this.failingInsert = true
  }

  stampOf(groupId: number, userId: number): Stamp | null | undefined {
    return this.members.find((m) => m.member.groupId === groupId && m.member.userId === userId)
      ?.stamp
  }

  all(): GroupMember[] {
    return this.members.map((m) => m.member)
  }
}
