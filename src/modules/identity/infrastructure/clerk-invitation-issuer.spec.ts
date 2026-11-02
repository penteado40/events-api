import { createClerkClient } from '@clerk/backend'
import { describe, it } from 'vitest'
import { describeInvitationIssuerContract } from '../application/testing/invitation-issuer.contract.js'
import { ClerkInvitationIssuer } from './clerk-invitation-issuer.js'

/** Runs only with a Clerk development instance in the env (its secret key). */
const secretKey = process.env.CLERK_TEST_SECRET_KEY

if (secretKey) {
  const clerk = createClerkClient({ secretKey })
  const run = Date.now()
  let sequence = 0

  describeInvitationIssuerContract('Clerk', () => ({
    issuer: new ClerkInvitationIssuer({ secretKey, redirectUrl: null, ttlDays: 1 }),
    freshEmail: () => `contract+${run}-${++sequence}@example.com`,
    async cleanup(ids) {
      await Promise.allSettled(ids.map((id) => clerk.invitations.revokeInvitation(id)))
    },
  }))
} else {
  describe('InvitationIssuer contract: Clerk', () => {
    it.skip('needs CLERK_TEST_SECRET_KEY', () => {})
  })
}
