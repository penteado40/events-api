import type { Clock } from '../../../../shared/application/clock.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { loadEventFor } from '../event-access.js'
import { findMemberOrThrow } from '../event-members.js'
import type { IssuedActivationLink, MemberAccounts } from '../ports/member-accounts.js'
import type { Requester } from '../requester.js'

export interface IssueMemberActivationLinkInput {
  actor: Requester
  eventId: number
  userId: number
}

export type IssueMemberActivationLinkOutput = IssuedActivationLink

/**
 * An Owner reissues the Activation link of a Pending user who is a member of
 * their Event. The User's previous link stops working, whoever issued it.
 */
export class IssueMemberActivationLinkUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly accounts: MemberAccounts,
    private readonly clock: Clock,
  ) {}

  async execute(input: IssueMemberActivationLinkInput): Promise<IssueMemberActivationLinkOutput> {
    await loadEventFor(this.events, input.actor, input.eventId, 'member:manage')
    const member = await findMemberOrThrow(this.events, input.eventId, input.userId)
    return this.accounts.reissueActivationLink(member.userId, {
      by: input.actor.id,
      at: this.clock.now(),
    })
  }
}
