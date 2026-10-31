import type { GroupMember } from '../../domain/group-member.js'
import { GroupMemberRepository } from '../../domain/group-member.repository.js'

export class InMemoryGroupMemberRepository extends GroupMemberRepository {
  private readonly members: GroupMember[] = []

  async findByUser(userId: number): Promise<GroupMember[]> {
    return this.members.filter((m) => m.userId === userId)
  }

  /** Arranges a Group member, as the writes of PROJ-172 and PROJ-177 will. */
  add(member: GroupMember): void {
    this.members.push(member)
  }

  all(): GroupMember[] {
    return [...this.members]
  }
}
