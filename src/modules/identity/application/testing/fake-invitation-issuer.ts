import type { Clock } from '../../../../shared/application/clock.js'
import { InvitationIssuer, type IssuedInvitation } from '../ports/invitation-issuer.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Predictable invitations (`inv_1`, `inv_2`...) that expire `ttlDays` after the
 * clock's now. `failNextIssue` makes the next issue throw, as Clerk out of air would.
 */
export class FakeInvitationIssuer extends InvitationIssuer {
  private sequence = 0
  private failing = false
  private readonly invitations = new Map<string, { email: string; revoked: boolean }>()

  constructor(
    private readonly clock: Clock,
    private readonly ttlDays = 7,
  ) {
    super()
  }

  async issue(email: string): Promise<IssuedInvitation> {
    if (this.failing) {
      this.failing = false
      throw new Error('fake invitation issuer: issue failed')
    }
    this.sequence += 1
    const id = `inv_${this.sequence}`
    this.invitations.set(id, { email, revoked: false })
    return {
      id,
      url: `https://accounts.clerk.test/accept?invitation=${id}`,
      expiresAt: new Date(this.clock.now().getTime() + this.ttlDays * DAY_MS),
    }
  }

  async revoke(id: string): Promise<void> {
    const invitation = this.invitations.get(id)
    if (!invitation) throw new Error(`fake invitation issuer: no invitation ${id}`)
    invitation.revoked = true
  }

  failNextIssue(): void {
    this.failing = true
  }

  /** Ids of the invitations still usable. */
  open(): string[] {
    return [...this.invitations].filter(([, i]) => !i.revoked).map(([id]) => id)
  }

  /** Ids of the revoked invitations. */
  revoked(): string[] {
    return [...this.invitations].filter(([, i]) => i.revoked).map(([id]) => id)
  }
}
