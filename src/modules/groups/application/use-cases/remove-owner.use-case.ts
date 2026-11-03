import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface RemoveOwnerInput {
  actor: ActingUser
  groupId: number
  /** The Owner to take out of the Group. */
  userId: number
}

/**
 * The Super admin takes an Owner out of the Group, never the last one
 * (ADR-0017). The Roster is read under the Group's lock, so two writes never
 * judge the same stale Roster (ADR-0014). Who cannot see the Group gets
 * NOT_FOUND; a Group member gets FORBIDDEN.
 */
export class RemoveOwnerUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly members: GroupMemberRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: RemoveOwnerInput): Promise<void> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    if (!AccessPolicy.can(actor, { type: 'viewGroup', groupId })) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'manageOwners', groupId })) {
      throw new AppError('FORBIDDEN')
    }

    await this.unitOfWork.run(async () => {
      const roster = await this.rosters.lockByGroup(groupId)
      if (!roster) throw new AppError('NOT_FOUND')
      roster.removeOwner(input.userId)
      await this.rosters.save(roster)
    })
  }
}
