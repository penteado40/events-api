import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMember } from '../../domain/group-member.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface DemoteSelfInput {
  actor: ActingUser
  groupId: number
}

export type DemoteSelfOutput = GroupMember

/**
 * An Owner makes themselves a Viewer, unless they are the last Owner
 * (ADR-0017), judging the Roster read under the Group's lock (ADR-0014). A
 * Viewer or the Super admin gets FORBIDDEN; who cannot see the Group,
 * NOT_FOUND.
 */
export class DemoteSelfUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly members: GroupMemberRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: DemoteSelfInput): Promise<DemoteSelfOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    if (!AccessPolicy.can(actor, { type: 'viewGroup', groupId })) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'demoteSelf', groupId })) throw new AppError('FORBIDDEN')

    const stamp = { by: input.actor.id, at: this.clock.now() }
    return this.unitOfWork.run(async () => {
      const roster = await this.rosters.lockByGroup(groupId)
      if (!roster) throw new AppError('NOT_FOUND')
      const member = roster.demoteSelf(input.actor.id, stamp)
      await this.rosters.save(roster)
      return member
    })
  }
}
