import { AuthVerifier, type VerifiedIdentity } from '../ports/auth-verifier.js'

const PREFIX = 'fake-session.'

/**
 * Accepts the tokens tests build with `FakeAuthVerifier.tokenFor`, and nothing
 * else. Stateless, so a test can build a token without reaching the app's instance.
 */
export class FakeAuthVerifier extends AuthVerifier {
  static tokenFor(identity: VerifiedIdentity): string {
    return PREFIX + Buffer.from(JSON.stringify(identity)).toString('base64url')
  }

  async verify(token: string): Promise<VerifiedIdentity | null> {
    if (!token.startsWith(PREFIX)) return null
    try {
      const claims: unknown = JSON.parse(
        Buffer.from(token.slice(PREFIX.length), 'base64url').toString(),
      )
      if (!isIdentity(claims)) return null
      return { externalId: claims.externalId, email: claims.email }
    } catch {
      return null
    }
  }
}

function isIdentity(value: unknown): value is VerifiedIdentity {
  if (typeof value !== 'object' || value === null) return false
  const { externalId, email } = value as Record<string, unknown>
  return typeof externalId === 'string' && externalId !== '' && typeof email === 'string'
}
