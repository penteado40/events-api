/** What a verified webhook from the identity provider asks of us (ADR-0020). */
export type IdentityWebhookEvent =
  | {
      type: 'USER_UPDATED'
      /** The provider's user id, matched against the User's `clerkId`. */
      externalId: string
      /** The full name; null when the account has none. */
      name: string | null
      /** The verified primary email; null when there is none. */
      email: string | null
    }
  /** A verified event we do not act on. */
  | { type: 'IGNORED' }

/** The raw request a webhook arrives as: the signature covers the bytes of the body. */
export interface WebhookRequest {
  rawBody: Buffer
  headers: Record<string, string | string[] | undefined>
}

/**
 * Checks the signature of a webhook from the identity provider and reads it.
 * Answers null for any request it does not accept (no signature, forged,
 * replayed, malformed), so the caller never learns why.
 */
export abstract class IdentityWebhookVerifier {
  abstract verify(request: WebhookRequest): IdentityWebhookEvent | null
}
