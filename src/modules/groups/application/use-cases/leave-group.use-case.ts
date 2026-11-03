import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import { type ActingUser, actorOf } from '../actor.js'
import { assertStillOwner } from '../owner-self.js'

export interface LeaveGroupInput {
  actor: ActingUser
  groupId: number
}

/**
 * An Owner leaves the Group, unless they are the last one (ADR-0017). Two
 * Owners leaving at once are serialized by the Group's lock (ADR-0014): the
 * second waits, reads the Roster without the first, and gets LAST_OWNER.
 * Viewers do not leave on their own (FORBIDDEN); who cannot see the Group
 * gets NOT_FOUND.
 */
export class LeaveGroupUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly members: GroupMemberRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: LeaveGroupInput): Promise<void> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    if (!AccessPolicy.can(actor, { type: 'viewGroup', groupId })) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'leaveGroup', groupId })) throw new AppError('FORBIDDEN')

    await this.unitOfWork.run(async () => {
      const roster = await this.rosters.lockByGroup(groupId)
      if (!roster) throw new AppError('NOT_FOUND')
      assertStillOwner(roster, input.actor.id)
      roster.removeOwner(input.actor.id)
      await this.rosters.save(roster)
    })
  }
}
