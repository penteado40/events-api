import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupMemberRemoved } from '../../domain/events/group-member-removed.event.js'
import type { GroupUserAccounts } from '../ports/group-user-accounts.js'

/**
 * A Pending user left with no Group member anywhere loses their Activation
 * link. Identity keeps the link of an active User as history, and of a Super
 * admin, who needs no Group member. Runs after the response (ADR-0010): a
 * failure is logged by the publisher and never undoes the removal.
 */
export class OnGroupMemberRemovedHandler {
  constructor(
    private readonly members: GroupMemberRepository,
    private readonly accounts: GroupUserAccounts,
  ) {}

  async handle(event: GroupMemberRemoved): Promise<void> {
    if ((await this.members.findByUser(event.userId)).length > 0) return
    await this.accounts.dropPendingActivation(event.userId)
  }
}
