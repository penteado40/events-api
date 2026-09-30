import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { EventRole } from '../../domain/event-member.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { MembershipRules } from '../../domain/membership-rules.js'
import { loadEventFor } from '../event-access.js'
import { type EventMemberView, memberActor } from '../event-members.js'
import type { IssuedActivationLink, MemberAccounts } from '../ports/member-accounts.js'
import type { Requester } from '../requester.js'

export interface AddEventMemberInput {
  actor: Requester
  eventId: number
  email: string
  /** Used only when the email has no User yet. */
  name: string
  role: EventRole
}

export interface AddEventMemberOutput extends EventMemberView {
  /** Only when a Pending user was created now; hand it to the person. */
  activation: IssuedActivationLink | null
}

/**
 * An Owner adds an Event member by email: an existing User is only linked,
 * a new email becomes a Pending user with an Activation link.
 */
export class AddEventMemberUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly accounts: MemberAccounts,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddEventMemberInput): Promise<AddEventMemberOutput> {
    const { membership } = await loadEventFor(
      this.events,
      input.actor,
      input.eventId,
      'member:manage',
    )
    MembershipRules.assertCanAdd(memberActor(input.actor, membership))

    const stamp = { by: input.actor.id, at: this.clock.now() }
    const { user, activation } = await this.accounts.findOrCreatePending(
      { email: input.email, name: input.name },
      stamp,
    )
    // The Super admin reaches every Event through the role, never as a member.
    if (user.isSuperAdmin) throw new AppError('USER_IS_SUPER_ADMIN')
    if (await this.events.findMember(input.eventId, user.id)) {
      throw new AppError('MEMBER_ALREADY_EXISTS')
    }

    const member = await this.events.createMember(
      { eventId: input.eventId, userId: user.id, role: input.role },
      stamp,
    )
    return { member, user, activation }
  }
}
