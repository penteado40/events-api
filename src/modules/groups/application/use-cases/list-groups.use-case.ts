import { AccessPolicy } from '../../domain/access-policy.js'
import type { Group } from '../../domain/group.entity.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface ListGroupsInput {
  actor: ActingUser
}

export type ListGroupsOutput = Group[]

/** The Super admin sees every Group; a User sees the Groups they are a Group member of. By name. */
export class ListGroupsUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
  ) {}

  async execute(input: ListGroupsInput): Promise<ListGroupsOutput> {
    const actor = await actorOf(input.actor, this.members)
    if (AccessPolicy.can(actor, { type: 'listAllGroups' })) return this.groups.findAll()

    const groups = await this.groups.findManyByIds([...actor.membership.keys()])
    // Always true today; the AccessPolicy stays the only owner of who sees what (ADR-0019).
    return groups.filter((g) => AccessPolicy.can(actor, { type: 'viewGroup', groupId: g.id }))
  }
}
