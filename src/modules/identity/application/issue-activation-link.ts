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

function toActivationLink({ url, expiresAt }: IssuedInvitation): IssuedActivationLink {
  return { url, expiresAt }
}

/**
 * Runs `write` after the invitation exists, and revokes the invitation if the
 * write fails, so no usable link is left without a stored record (ADR-0014).
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
    // Best effort: the write's error is the one that matters to the caller.
    await invitations.revoke(invitation.id).catch(() => undefined)
    throw error
  }
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
    await links.replaceForUser(
      { userId: user.id, invitationId: invitation.id, expiresAt: invitation.expiresAt },
      stamp,
    )
    return { user, activationLink: toActivationLink(invitation) }
  })
}

/** Reissues the link of a Pending user: NOT_FOUND without the User, USER_ALREADY_ACTIVE once active. */
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
  return withInvitation(invitations, user.email, async (invitation) => {
    await links.replaceForUser(
      { userId: user.id, invitationId: invitation.id, expiresAt: invitation.expiresAt },
      stamp,
    )
    return toActivationLink(invitation)
  })
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
