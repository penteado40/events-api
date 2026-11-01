import { AppError } from '../../../../shared/domain/app-error.js'
import { Group } from '../../domain/group.entity.js'
import { GroupRoster } from '../../domain/group-roster.js'
import { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import type { InMemoryGroupMemberRepository } from './in-memory-group-member.repository.js'
import type { InMemoryGroupRepository } from './in-memory-group.repository.js'

/** Reads and writes over the in-memory Groups and Group members, so every read agrees. */
export class InMemoryGroupRosterRepository extends GroupRosterRepository {
  constructor(
    private readonly groups: InMemoryGroupRepository,
    private readonly members: InMemoryGroupMemberRepository,
  ) {
    super()
  }

  async findByGroup(groupId: number): Promise<GroupRoster | null> {
    const group = await this.groups.findById(groupId)
    if (!group) return null
    return GroupRoster.restore({
      groupId,
      hasHadOwner: group.hasHadOwner,
      members: this.members.ofGroup(groupId),
    })
  }

  async save(roster: GroupRoster): Promise<void> {
    const { added, firstOwner } = roster.changes()
    const taken = new Set(this.members.ofGroup(roster.groupId).map((m) => m.userId))
    if (added.some(({ member }) => taken.has(member.userId))) {
      throw new AppError('ALREADY_A_GROUP_MEMBER')
    }
    for (const { member, stamp } of added) this.members.insert(member, stamp)

    const group = await this.groups.findById(roster.groupId)
    if (group && firstOwner) {
      await this.groups.save(
        Group.restore({
          id: group.id,
          name: group.name,
          hasHadOwner: true,
          createdAt: group.createdAt,
          createdById: group.createdById,
          updatedAt: firstOwner.at,
          updatedById: firstOwner.by,
        }),
      )
    }
  }
}
