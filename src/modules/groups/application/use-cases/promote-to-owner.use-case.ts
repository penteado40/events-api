import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMember } from '../../domain/group-member.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface PromoteToOwnerInput {
  actor: ActingUser
  groupId: number
  /** The Viewer to make an Owner; an Owner stays as they are. */
  userId: number
}

export type PromoteToOwnerOutput = GroupMember

/**
 * The Super admin makes a Viewer an Owner (ADR-0017); in a Group born without
 * an Owner, this is its first. Who cannot see the Group gets NOT_FOUND; a
 * Group member gets FORBIDDEN.
 */
export class PromoteToOwnerUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly members: GroupMemberRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: PromoteToOwnerInput): Promise<PromoteToOwnerOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    if (!AccessPolicy.can(actor, { type: 'viewGroup', groupId })) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'manageOwners', groupId })) {
      throw new AppError('FORBIDDEN')
    }

    const stamp = { by: input.actor.id, at: this.clock.now() }
    return this.unitOfWork.run(async () => {
      const roster = await this.rosters.lockByGroup(groupId)
      if (!roster) throw new AppError('NOT_FOUND')
      const member = roster.promoteViewer(input.userId, stamp)
      await this.rosters.save(roster)
      return member
    })
  }
}
