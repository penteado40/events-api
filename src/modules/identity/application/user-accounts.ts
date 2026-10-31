import { AppError } from '../../../shared/domain/app-error.js'
import { Email } from '../../../shared/domain/email.vo.js'
import { Phone } from '../../../shared/domain/phone.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ActivationLinkRepository } from '../domain/activation-link.repository.js'
import type { UserRepository } from '../domain/user.repository.js'
import {
  createPendingUser,
  dropPendingActivation,
  type IssuedActivationLink,
  reissueActivationLink,
} from './issue-activation-link.js'
import type { InvitationIssuer } from './ports/invitation-issuer.js'
import { toUserSummary, type UserSummary } from './user-lookup.js'

export interface EnsuredUser {
  user: UserSummary
  /** Only for a User created just now; an existing User is never touched. */
  activationLink: IssuedActivationLink | null
}

/**
 * The writes on Users that identity offers other contexts: making sure a User
 * exists for an email (e.g. a Group member added by email), and managing a
 * Pending user's Activation link. Who may do it is the caller's call; a User
 * and their link belong to the platform, not to any Group.
 */
export class UserAccounts {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly invitations: InvitationIssuer,
  ) {}

  /** The User of the email, created as a Pending user with an Activation link when there is none. */
  async ensureUser(
    input: { email: string; name: string; phone: string },
    stamp: Stamp,
  ): Promise<EnsuredUser> {
    const email = Email.create(input.email)
    const phone = Phone.create(input.phone)
    const found = await this.users.findByEmail(email)
    if (found) return { user: toUserSummary(found), activationLink: null }

    try {
      const { user, activationLink } = await createPendingUser(
        this.users,
        this.links,
        this.invitations,
        { name: input.name, email, phone },
        stamp,
      )
      return { user: toUserSummary(user), activationLink }
    } catch (error) {
      // Someone created the same email meanwhile: it is an existing User now.
      if (!(error instanceof AppError && error.code === 'EMAIL_ALREADY_IN_USE')) throw error
      const winner = await this.users.findByEmail(email)
      if (!winner) throw error
      return { user: toUserSummary(winner), activationLink: null }
    }
  }

  /** A fresh link for a Pending user. */
  async reissueActivationLink(userId: number, stamp: Stamp): Promise<IssuedActivationLink> {
    return reissueActivationLink(this.users, this.links, this.invitations, userId, stamp)
  }

  /** Revokes a Pending user's link, so nobody activates an account with no purpose. */
  async dropPendingActivation(userId: number): Promise<void> {
    return dropPendingActivation(this.users, this.links, this.invitations, userId)
  }
}
