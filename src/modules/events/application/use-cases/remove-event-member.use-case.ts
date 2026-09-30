import type { EventRepository } from '../../domain/event.repository.js'
import { MembershipRules } from '../../domain/membership-rules.js'
import { loadEventFor } from '../event-access.js'
import { findMemberOrThrow, memberActor } from '../event-members.js'
import type { MemberAccounts } from '../ports/member-accounts.js'
import type { Requester } from '../requester.js'

export interface RemoveEventMemberInput {
  actor: Requester
  eventId: number
  userId: number
}

/**
 * An Owner removes a member, or a member leaves on their own. A Pending user
 * left with no Event loses their Activation link (ADR-0003).
 */
export class RemoveEventMemberUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly accounts: MemberAccounts,
  ) {}

  async execute(input: RemoveEventMemberInput): Promise<void> {
    const leaving = !input.actor.isSuperAdmin && input.actor.id === input.userId
    const { membership } = await loadEventFor(
      this.events,
      input.actor,
      input.eventId,
      leaving ? 'member:leave' : 'member:manage',
    )
    const member = await findMemberOrThrow(this.events, input.eventId, input.userId)
    MembershipRules.assertCanRemove(memberActor(input.actor, membership), {
      userId: member.userId,
      membership: member.membership,
    })

    await this.events.deleteMember(member)
    if ((await this.events.countMembershipsOf(member.userId)) === 0) {
      await this.accounts.dropPendingActivation(member.userId)
    }
  }
}
