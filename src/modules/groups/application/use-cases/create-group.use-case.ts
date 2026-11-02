import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import { GroupName } from '../../domain/group-name.vo.js'
import type { Group } from '../../domain/group.entity.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface CreateGroupInput {
  actor: ActingUser
  name: string
}

export type CreateGroupOutput = Group

/** The Super admin creates a Group with a name and no Group members. */
export class CreateGroupUseCase {
  constructor(
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateGroupInput): Promise<CreateGroupOutput> {
    const actor = await actorOf(input.actor, this.members)
    if (!AccessPolicy.can(actor, { type: 'createGroup' })) throw new AppError('FORBIDDEN')

    const name = GroupName.create(input.name)
    const stamp = { by: input.actor.id, at: this.clock.now() }
    return this.groups.create({ name }, stamp)
  }
}
