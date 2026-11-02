import { AppError } from '../../../shared/domain/app-error.js'
import type { Email } from '../../../shared/domain/email.vo.js'
import type { Phone } from '../../../shared/domain/phone.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ActivationLinkRepository } from '../domain/activation-link.repository.js'
import type { User } from '../domain/user.entity.js'
import type { UserRepository } from '../domain/user.repository.js'
import type { InvitationIssuer, IssuedInvitation } from './ports/invitation-issuer.js'

/** What goes back to whoever delivers the Activation link (ADR-0020). */
export interface IssuedActivationLink {
  url: string
  expiresAt: Date
}

/** A User together with the Activation link just issued for them. */
export interface UserWithActivationLink {
  user: User
  activationLink: IssuedActivationLink
}

/**
 * The life of a Pending user's Activation link, shared by the use cases and by
 * UserAccounts: one Clerk invitation and one stored record per Pending user,
 * never one without the other (ADR-0014, ADR-0020). Who may do it is the
 * caller's call, and so is which email goes out: these methods email nobody.
 */
export class ActivationLinks {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly invitations: InvitationIssuer,
  ) {}

  /**
   * Creates a Pending user and their first Activation link, both by the stamp's
   * Author. The invitation comes first: if Clerk fails, no User is created.
   */
  async createPendingUser(
    props: { name: string; email: Email; phone: Phone },
    stamp: Stamp,
  ): Promise<UserWithActivationLink> {
    return this.withInvitation(props.email, async (invitation) => {
      const user = await this.users.create(
        { name: props.name.trim(), email: props.email, phone: props.phone, role: 'USER' },
        stamp,
      )
      return { user, activationLink: await this.store(user.id, invitation, stamp) }
    })
  }

  /**
   * Reissues the link of a Pending user and revokes the previous one, so a lost
   * or leaked link stops working: NOT_FOUND without the User, USER_ALREADY_ACTIVE once active.
   */
  async reissue(userId: number, stamp: Stamp): Promise<UserWithActivationLink> {
    const user = await this.users.findById(userId)
    if (!user) throw new AppError('NOT_FOUND')
    if (!user.isPending) throw new AppError('USER_ALREADY_ACTIVE')
    const previous = await this.links.findForUser(user.id)
    const activationLink = await this.withInvitation(user.email, (invitation) =>
      this.store(user.id, invitation, stamp),
    )
    if (previous) await this.invitations.revoke(previous.invitationId)
    return { user, activationLink }
  }

  /** Revokes and drops a Pending user's link; an active User's link stays as history. */
  async dropPending(userId: number): Promise<void> {
    const user = await this.users.findById(userId)
    if (!user?.isPending) return
    const link = await this.links.findForUser(user.id)
    if (!link) return
    await this.invitations.revoke(link.invitationId)
    await this.links.deleteForUser(user.id)
  }

  /**
   * Runs `write` after the invitation exists, and revokes the invitation if the
   * write fails, so no usable link is left without a stored record (ADR-0014).
   * The write's error is the one that reaches the caller, unless the revoke
   * fails too: then the error names the invitation left open, for the logs.
   */
  private async withInvitation<T>(
    email: Email,
    write: (invitation: IssuedInvitation) => Promise<T>,
  ): Promise<T> {
    const invitation = await this.invitations.issue(email.value)
    try {
      return await write(invitation)
    } catch (error) {
      try {
        await this.invitations.revoke(invitation.id)
      } catch (revokeError) {
        throw new AggregateError(
          [error, revokeError],
          `Gravação falhou e o convite ${invitation.id} ficou aberto: revogue-o no Clerk`,
          { cause: revokeError },
        )
      }
      throw error
    }
  }

  /** Stores the invitation as the User's Activation link, in place of the previous one. */
  private async store(
    userId: number,
    invitation: IssuedInvitation,
    stamp: Stamp,
  ): Promise<IssuedActivationLink> {
    await this.links.replaceForUser(
      { userId, invitationId: invitation.id, expiresAt: invitation.expiresAt },
      stamp,
    )
    return { url: invitation.url, expiresAt: invitation.expiresAt }
  }
}
