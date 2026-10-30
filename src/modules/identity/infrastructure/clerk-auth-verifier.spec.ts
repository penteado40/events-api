import { createClerkClient } from '@clerk/backend'
import { describe, it } from 'vitest'
import { describeAuthVerifierContract } from '../application/testing/auth-verifier.contract.js'
import { ClerkAuthVerifier } from './clerk-auth-verifier.js'

/**
 * Runs only with a Clerk development instance in the env: its secret key and
 * a User of it to open sessions for. The instance needs the session claims of
 * docs/infra.md, as production does.
 */
const secretKey = process.env.CLERK_TEST_SECRET_KEY
const userId = process.env.CLERK_TEST_USER_ID

/** The default session token has no email: fail with the fix, not with a bare null. */
function assertEmailClaims(jwt: string): void {
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString())
  if (!('email' in claims) || !('email_verified' in claims)) {
    throw new Error(
      'O token não tem os claims email e email_verified: configure-os na instância (docs/infra.md)',
    )
  }
}

if (secretKey && userId) {
  const clerk = createClerkClient({ secretKey })

  describeAuthVerifierContract('Clerk', () => ({
    verifier: new ClerkAuthVerifier({ secretKey, jwtKey: null, authorizedParties: [] }),
    async issueValidToken() {
      const user = await clerk.users.getUser(userId)
      const session = await clerk.sessions.createSession({ userId })
      try {
        const { jwt } = await clerk.sessions.getToken(session.id)
        assertEmailClaims(jwt)
        const email = user.primaryEmailAddress?.emailAddress
        if (!email) throw new Error(`CLERK_TEST_USER_ID ${userId} não tem email principal`)
        return { token: jwt, identity: { externalId: userId, email } }
      } finally {
        await clerk.sessions.revokeSession(session.id)
      }
    },
  }))
} else {
  describe('AuthVerifier contract: Clerk', () => {
    it.skip('needs CLERK_TEST_SECRET_KEY and CLERK_TEST_USER_ID', () => {})
  })
}
