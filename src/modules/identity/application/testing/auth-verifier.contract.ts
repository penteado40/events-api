import { describe, expect, it } from 'vitest'
import type { AuthVerifier, VerifiedIdentity } from '../ports/auth-verifier.js'

export interface AuthVerifierContractSubject {
  verifier: AuthVerifier
  /** A token the verifier must accept, and the identity it must answer for it. */
  issueValidToken(): Promise<{ token: string; identity: VerifiedIdentity }>
}

/** A JWT with plausible claims and a signature nobody issued. */
function forgedJwt(): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return [
    part({ alg: 'RS256', typ: 'JWT', kid: 'ins_forged' }),
    part({ sub: 'user_forged', email: 'forged@example.com', iat: now, exp: now + 60 }),
    Buffer.from('not-a-signature').toString('base64url'),
  ].join('.')
}

/**
 * What every AuthVerifier promises. Runs against the fake in CI, and against
 * the Clerk adapter when the env has test credentials.
 */
export function describeAuthVerifierContract(
  name: string,
  setup: () => AuthVerifierContractSubject,
): void {
  describe(`AuthVerifier contract: ${name}`, () => {
    it('answers the identity of a token it issued', async () => {
      const subject = setup()
      const { token, identity } = await subject.issueValidToken()

      await expect(subject.verifier.verify(token)).resolves.toEqual(identity)
    })

    it('answers null for a malformed token', async () => {
      const { verifier } = setup()

      for (const token of ['', 'garbage', 'a.b.c']) {
        await expect(verifier.verify(token)).resolves.toBeNull()
      }
    })

    it('answers null for a JWT it did not sign', async () => {
      const { verifier } = setup()

      await expect(verifier.verify(forgedJwt())).resolves.toBeNull()
    })
  })
}
