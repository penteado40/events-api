/** A Clerk invitation (ADR-0020): the Activation link a Pending user signs up through. */
export interface IssuedInvitation {
  /** The provider's id, so the invitation can be revoked later. */
  id: string
  /** Goes to whoever delivers the Activation link; the email is never sent by the provider. */
  url: string
  expiresAt: Date
}

/**
 * What the app shows on the "Ativar conta" screen, carried in the invitation's
 * redirect. Display only: who signs up is decided by the invitation itself, so
 * every part is optional (an invitation made by hand has none).
 */
export interface InvitationRedirect {
  /** Name of whoever created the User or asked for the new link. */
  inviter?: string
  /** Name of the Group, when the invitation comes from adding the person to it. */
  group?: string
  /** Name of the Pending user. */
  name?: string
}

/** Issues and revokes the invitations that are the Activation links. */
export abstract class InvitationIssuer {
  /** Issues a new invitation for the email, even if another one is still open. */
  abstract issue(email: string, redirect?: InvitationRedirect): Promise<IssuedInvitation>
  /** Makes the invitation unusable; one already revoked is a no-op. */
  abstract revoke(id: string): Promise<void>
}
