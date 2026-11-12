import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMember } from '../../domain/group-member.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'
import type { GroupMemberUser, GroupUsers } from '../ports/group-users.js'

export interface ListGroupMembersInput {
  actor: ActingUser
  groupId: number
}

export type ListGroupMembersOutput = { member: GroupMember; user: GroupMemberUser }[]

/**
 * The Super admin or a Group member sees who is in the Group, with each
 * one's role and phone (to open WhatsApp); anyone else gets NOT_FOUND, so it
 * does not leak. In the order they joined.
 */
export class ListGroupMembersUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly users: GroupUsers,
  ) {}

  async execute(input: ListGroupMembersInput): Promise<ListGroupMembersOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
      ? await this.groups.findById(groupId)
      : null
    if (!group) throw new AppError('NOT_FOUND')

    const groupMembers = await this.members.findByGroup(groupId)
    const users = await this.users.findManyByIds(groupMembers.map((m) => m.userId))
    const byId = new Map(users.map((u) => [u.id, u]))
    // The FKs (GroupMember.user Restrict, GroupMember.group Cascade) make a
    // persistent orphan impossible: a row without its User only shows up in a
    // race with the Group's deletion, and skipping it is correct.
    return groupMembers.flatMap((member) => {
      const user = byId.get(member.userId)
      return user ? [{ member, user }] : []
    })
  }
}
