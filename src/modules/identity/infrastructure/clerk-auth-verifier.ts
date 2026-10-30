import { Injectable } from '@nestjs/common'
import { verifyToken } from '@clerk/backend'
import { TokenVerificationError, TokenVerificationErrorReason } from '@clerk/backend/errors'
import { AuthVerifier, type VerifiedIdentity } from '../application/ports/auth-verifier.js'

export interface ClerkAuthVerifierOptions {
  /** Null outside production when unset: every token is then a server error, not a 401. */
  secretKey: string | null
  /** PEM public key: verifies without fetching the JWKS. Null fetches (and caches) it. */
  jwtKey: string | null
  /** Accepted `azp` origins; empty skips the check. */
  authorizedParties: readonly string[]
}

/** Failures of our side (key, network), not of the token: they surface as 500s. */
const SERVER_SIDE_REASONS = new Set<string>([
  TokenVerificationErrorReason.InvalidSecretKey,
  TokenVerificationErrorReason.RemoteJWKFailedToLoad,
])

/**
 * Verifies Clerk session tokens with `verifyToken` (ADR-0020). The default
 * session token has no email: the Clerk instance adds the `email` and
 * `email_verified` claims (docs/infra.md), and a token without a verified
 * email is refused.
 */
@Injectable()
export class ClerkAuthVerifier extends AuthVerifier {
  constructor(private readonly options: ClerkAuthVerifierOptions) {
    super()
  }

  async verify(token: string): Promise<VerifiedIdentity | null> {
    const { secretKey, jwtKey, authorizedParties } = this.options
    if (!secretKey) throw new Error('CLERK_SECRET_KEY não definida: sem ela o Clerk não verifica')
    let claims: Record<string, unknown>
    try {
      claims = await verifyToken(token, {
        secretKey,
        ...(jwtKey && { jwtKey }),
        ...(authorizedParties.length > 0 && { authorizedParties: [...authorizedParties] }),
      })
    } catch (error) {
      if (error instanceof TokenVerificationError && !SERVER_SIDE_REASONS.has(error.reason)) {
        return null
      }
      throw error
    }
    const { sub, email, email_verified: emailVerified } = claims
    if (typeof sub !== 'string' || typeof email !== 'string') return null
    if (emailVerified !== true && emailVerified !== 'true') return null
    return { externalId: sub, email }
  }
}
