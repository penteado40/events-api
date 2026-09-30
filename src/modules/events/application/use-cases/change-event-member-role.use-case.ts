import type { Clock } from '../../../../shared/application/clock.js'
import type { EventRole } from '../../domain/event-member.js'
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

export interface ChangeEventMemberRoleInput {
  actor: Requester
  eventId: number
  userId: number
  role: EventRole
}

export type ChangeEventMemberRoleOutput = EventMemberView

/** An Owner changes a member's role, within the MembershipRules (ADR-0003). Idempotent. */
export class ChangeEventMemberRoleUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserDirectory,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangeEventMemberRoleInput): Promise<ChangeEventMemberRoleOutput> {
    const { membership } = await loadEventFor(
      this.events,
      input.actor,
      input.eventId,
      'member:manage',
    )
    const member = await findMemberOrThrow(this.events, input.eventId, input.userId)
    MembershipRules.assertCanChangeRole(
      memberActor(input.actor, membership),
      { userId: member.userId, membership: member.membership },
      input.role,
    )

    if (member.changeRole(input.role, { by: input.actor.id, at: this.clock.now() })) {
      await this.events.saveMember(member)
    }
    const [view] = await withUsers(this.users, [member])
    return view as EventMemberView
  }
}
