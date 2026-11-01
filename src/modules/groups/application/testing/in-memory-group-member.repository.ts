import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { GroupMember } from '../../domain/group-member.js'
import { GroupMemberRepository } from '../../domain/group-member.repository.js'

export class InMemoryGroupMemberRepository extends GroupMemberRepository {
  private readonly members: { member: GroupMember; stamp: Stamp | null }[] = []
  private failingAdd = false

  async findByUser(userId: number): Promise<GroupMember[]> {
    return this.all().filter((m) => m.userId === userId)
  }

  /** The Group members of the Group, in the order they were added. */
  ofGroup(groupId: number): GroupMember[] {
    return this.all().filter((m) => m.groupId === groupId)
  }

  /** Arranges a Group member, with no Author. */
  add(member: GroupMember): void {
    this.members.push({ member, stamp: null })
  }

  /** Stores a Group member as the roster writes them; `failNextAdd` makes it throw once. */
  insert(member: GroupMember, stamp: Stamp): void {
    if (this.failingAdd) {
      this.failingAdd = false
      throw new Error('in-memory group members: insert failed')
    }
    this.members.push({ member, stamp })
  }

  failNextAdd(): void {
    this.failingAdd = true
  }

  stampOf(groupId: number, userId: number): Stamp | null | undefined {
    return this.members.find((m) => m.member.groupId === groupId && m.member.userId === userId)
      ?.stamp
  }

  all(): GroupMember[] {
    return this.members.map((m) => m.member)
  }
}
