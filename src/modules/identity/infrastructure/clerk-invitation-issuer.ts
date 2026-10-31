import { createClerkClient } from '@clerk/backend'
import { InvitationIssuer, type IssuedInvitation } from '../application/ports/invitation-issuer.js'

export interface ClerkInvitationIssuerOptions {
  /** Null outside production when unset: issuing is then a server error. */
  secretKey: string | null
  /** Where the invitation lands (the events-expo deep link); null keeps Clerk's default. */
  redirectUrl: string | null
  /** Lifetime of each invitation, in whole days (Clerk's unit). */
  ttlDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Activation links as Clerk invitations (ADR-0020), created with `notify: false`:
 * the email goes out through us, and the url goes back to whoever created it.
 */
export class ClerkInvitationIssuer extends InvitationIssuer {
  private client: ReturnType<typeof createClerkClient> | null = null

  constructor(private readonly options: ClerkInvitationIssuerOptions) {
    super()
  }

  async issue(email: string): Promise<IssuedInvitation> {
    const { redirectUrl, ttlDays } = this.options
    const invitation = await this.clerk().invitations.createInvitation({
      emailAddress: email,
      notify: false,
      // A Pending user may get a new link while the old one is open (PROJ-173 revokes it).
      ignoreExisting: true,
      expiresInDays: ttlDays,
      ...(redirectUrl && { redirectUrl }),
    })
    if (!invitation.url) throw new Error(`Convite ${invitation.id} do Clerk veio sem url`)
    // The API answers `expires_at`, which the SDK's Invitation does not map yet.
    const expiresAt = (invitation.raw as { expires_at?: number } | null)?.expires_at
    return {
      id: invitation.id,
      url: invitation.url,
      expiresAt: new Date(expiresAt ?? invitation.createdAt + ttlDays * DAY_MS),
    }
  }

  async revoke(id: string): Promise<void> {
    await this.clerk().invitations.revokeInvitation(id)
  }

  private clerk(): ReturnType<typeof createClerkClient> {
    const { secretKey } = this.options
    if (!secretKey) throw new Error('CLERK_SECRET_KEY não definida: sem ela o Clerk não convida')
    this.client ??= createClerkClient({ secretKey })
    return this.client
  }
}
