import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { Group } from '../../domain/group.entity.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface RenameGroupInput {
  actor: ActingUser
  groupId: number
  name: string
}

export type RenameGroupOutput = Group

/**
 * The Super admin changes the name of a Group. Who cannot see the Group gets
 * NOT_FOUND, so its existence does not leak; a Group member gets FORBIDDEN.
 */
export class RenameGroupUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RenameGroupInput): Promise<RenameGroupOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
      ? await this.groups.findById(groupId)
      : null
    if (!group) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'renameGroup', groupId })) throw new AppError('FORBIDDEN')

    group.rename(input.name, { by: input.actor.id, at: this.clock.now() })
    await this.groups.save(group)
    return group
  }
}
