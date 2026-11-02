import { describe, expect, it } from 'vitest'
import type { InvitationIssuer } from '../ports/invitation-issuer.js'

export interface InvitationIssuerContractSubject {
  issuer: InvitationIssuer
  /** An email nobody else uses in this run, so runs against a real instance do not collide. */
  freshEmail(): string
  /** Revokes whatever the test left open, against a real instance. */
  cleanup?(ids: string[]): Promise<void>
}

/**
 * What every InvitationIssuer promises. Runs against the fake in CI, and
 * against the Clerk adapter when the env has test credentials.
 */
export function describeInvitationIssuerContract(
  name: string,
  setup: () => InvitationIssuerContractSubject,
): void {
  describe(`InvitationIssuer contract: ${name}`, () => {
    it('issues an invitation with an id, a url and an expiry in the future', async () => {
      const subject = setup()
      const invitation = await subject.issuer.issue(subject.freshEmail())
      try {
        expect(invitation.id).toEqual(expect.any(String))
        expect(invitation.id).not.toBe('')
        expect(() => new URL(invitation.url)).not.toThrow()
        expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now())
      } finally {
        await subject.cleanup?.([invitation.id])
      }
    })

    it('issues a second invitation for an email that still has one open', async () => {
      const subject = setup()
      const email = subject.freshEmail()
      const first = await subject.issuer.issue(email)
      const second = await subject.issuer.issue(email)
      try {
        expect(second.id).not.toBe(first.id)
      } finally {
        await subject.cleanup?.([first.id, second.id])
      }
    })

    it('revokes an invitation it issued', async () => {
      const subject = setup()
      const invitation = await subject.issuer.issue(subject.freshEmail())

      await expect(subject.issuer.revoke(invitation.id)).resolves.toBeUndefined()
    })
  })
}
