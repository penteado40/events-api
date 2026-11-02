import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { Group } from '../../domain/group.entity.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface GetGroupInput {
  actor: ActingUser
  groupId: number
}

export type GetGroupOutput = Group

/** The Super admin or a Group member sees the Group; anyone else gets NOT_FOUND, so it does not leak. */
export class GetGroupUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
  ) {}

  async execute(input: GetGroupInput): Promise<GetGroupOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
      ? await this.groups.findById(groupId)
      : null
    if (!group) throw new AppError('NOT_FOUND')
    return group
  }
}
