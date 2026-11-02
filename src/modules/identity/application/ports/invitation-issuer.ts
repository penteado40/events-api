/** A Clerk invitation (ADR-0020): the Activation link a Pending user signs up through. */
export interface IssuedInvitation {
  /** The provider's id, so the invitation can be revoked later. */
  id: string
  /** Goes to whoever delivers the Activation link; the email is never sent by the provider. */
  url: string
  expiresAt: Date
}

/** Issues and revokes the invitations that are the Activation links. */
export abstract class InvitationIssuer {
  /** Issues a new invitation for the email, even if another one is still open. */
  abstract issue(email: string): Promise<IssuedInvitation>
  /** Makes the invitation unusable. */
  abstract revoke(id: string): Promise<void>
}
