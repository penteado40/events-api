/** Who the identity provider says holds a session token (ADR-0020). */
export interface VerifiedIdentity {
  /** The provider's user id (Clerk's `sub`), stored on the User as `clerkId`. */
  externalId: string
  /** The verified email of that account, the key that links it to an invited User. */
  email: string
}

/**
 * Checks a session token issued by the identity provider. Answers null for
 * any token it does not accept (malformed, forged, expired, no verified email),
 * so the caller never learns why.
 */
export abstract class AuthVerifier {
  abstract verify(token: string): Promise<VerifiedIdentity | null>
}
