import type { Clock } from '../../../../shared/application/clock.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { MembershipRules } from '../../domain/membership-rules.js'
import { loadEventFor } from '../event-access.js'
import {
  type EventMemberView,
  findMemberOrThrow,
  memberActor,
  withUsers,
} from '../event-members.js'
import type { UserDirectory } from '../ports/user-directory.js'
import type { Requester } from '../requester.js'

export interface TransferPrimaryOwnerInput {
  actor: Requester
  eventId: number
  /** An Owner of the Event. */
  userId: number
}

/** Every member afterwards: two of them changed. */
export type TransferPrimaryOwnerOutput = EventMemberView[]

/**
 * The Primary owner hands the post to another Owner and stays on as an Owner
 * organizador. The Super admin uses it to name or replace the Primary owner.
 */
export class TransferPrimaryOwnerUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserDirectory,
    private readonly clock: Clock,
  ) {}

  async execute(input: TransferPrimaryOwnerInput): Promise<TransferPrimaryOwnerOutput> {
    const { membership } = await loadEventFor(
      this.events,
      input.actor,
      input.eventId,
      'member:manage',
    )
    const next = await findMemberOrThrow(this.events, input.eventId, input.userId)
    MembershipRules.assertCanTransferPrimary(memberActor(input.actor, membership), {
      userId: next.userId,
      membership: next.membership,
    })

    if (!next.isPrimaryOwner) {
      const members = await this.events.listMembers(input.eventId)
      const former = members.find((m) => m.isPrimaryOwner) ?? null
      const stamp = { by: input.actor.id, at: this.clock.now() }
      former?.stepDownAsPrimaryOwner(stamp)
      next.becomePrimaryOwner(stamp)
      await this.events.savePrimaryOwnerChange(former, next)
    }
    return withUsers(this.users, await this.events.listMembers(input.eventId))
  }
}
