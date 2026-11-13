import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupMemberRemoved } from '../../domain/events/group-member-removed.event.js'
import type { GroupUserAccounts } from '../ports/group-user-accounts.js'

/**
 * A Pending user left with no Group member anywhere loses their Activation
 * link. Identity keeps the link of an active User as history. Runs after the
 * response (ADR-0010): if revoking fails, the publisher logs it, the removal
 * stands and the link stays live. The damage is limited, since a User's access
 * comes only from their Group members (AccessPolicy): whoever accepts the link
 * enters and sees nothing. A Pending user with no tie and a stored link is the
 * state to look for if a reconciliation is ever needed.
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
