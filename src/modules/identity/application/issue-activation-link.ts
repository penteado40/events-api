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

/**
 * Runs `write` after the invitation exists, and revokes the invitation if the
 * write fails, so no usable link is left without a stored record (ADR-0014).
 * The write's error is the one that reaches the caller, unless the revoke
 * fails too: then the error names the invitation left open, for the logs.
 */
async function withInvitation<T>(
  invitations: InvitationIssuer,
  email: Email,
  write: (invitation: IssuedInvitation) => Promise<T>,
): Promise<T> {
  const invitation = await invitations.issue(email.value)
  try {
    return await write(invitation)
  } catch (error) {
    try {
      await invitations.revoke(invitation.id)
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
async function storeLink(
  links: ActivationLinkRepository,
  userId: number,
  invitation: IssuedInvitation,
  stamp: Stamp,
): Promise<IssuedActivationLink> {
  await links.replaceForUser(
    { userId, invitationId: invitation.id, expiresAt: invitation.expiresAt },
    stamp,
  )
  return { url: invitation.url, expiresAt: invitation.expiresAt }
}

/**
 * Creates a Pending user and their first Activation link, both by the stamp's
 * Author. The invitation comes first: if Clerk fails, no User is created.
 */
export async function createPendingUser(
  users: UserRepository,
  links: ActivationLinkRepository,
  invitations: InvitationIssuer,
  props: { name: string; email: Email; phone: Phone },
  stamp: Stamp,
): Promise<{ user: User; activationLink: IssuedActivationLink }> {
  return withInvitation(invitations, props.email, async (invitation) => {
    const user = await users.create(
      { name: props.name.trim(), email: props.email, phone: props.phone, role: 'USER' },
      stamp,
    )
    return { user, activationLink: await storeLink(links, user.id, invitation, stamp) }
  })
}

/**
 * Reissues the link of a Pending user and revokes the previous one, so a lost
 * or leaked link stops working: NOT_FOUND without the User, USER_ALREADY_ACTIVE once active.
 */
export async function reissueActivationLink(
  users: UserRepository,
  links: ActivationLinkRepository,
  invitations: InvitationIssuer,
  userId: number,
  stamp: Stamp,
): Promise<IssuedActivationLink> {
  const user = await users.findById(userId)
  if (!user) throw new AppError('NOT_FOUND')
  if (!user.isPending) throw new AppError('USER_ALREADY_ACTIVE')
  const previous = await links.findForUser(user.id)
  const link = await withInvitation(invitations, user.email, (invitation) =>
    storeLink(links, user.id, invitation, stamp),
  )
  if (previous) await invitations.revoke(previous.invitationId)
  return link
}

/** Revokes and drops a Pending user's link; an active User's link stays as history. */
export async function dropPendingActivation(
  users: UserRepository,
  links: ActivationLinkRepository,
  invitations: InvitationIssuer,
  userId: number,
): Promise<void> {
  const user = await users.findById(userId)
  if (!user?.isPending) return
  const link = await links.findForUser(user.id)
  if (!link) return
  await invitations.revoke(link.invitationId)
  await links.deleteForUser(user.id)
}
