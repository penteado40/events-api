import { beforeEach, describe, expect, it, vi } from 'vitest'

const createInvitation = vi.fn()
vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({ invitations: { createInvitation } }),
}))

const { ClerkInvitationIssuer } = await import('./clerk-invitation-issuer.js')

describe('ClerkInvitationIssuer redirect', () => {
  beforeEach(() => {
    createInvitation.mockReset()
    createInvitation.mockResolvedValue({
      id: 'inv_1',
      url: 'https://accounts.clerk.test/accept',
      createdAt: Date.now(),
      raw: { expires_at: Date.now() + 1000 },
    })
  })

  it('sends the redirect url with the inviter, group and name encoded', async () => {
    const issuer = new ClerkInvitationIssuer({
      secretKey: 'sk_test',
      redirectUrl: 'events-expo://activate',
      ttlDays: 7,
    })

    await issuer.issue('lu@x.com', {
      inviter: 'Bruno Reis',
      group: 'Vocal Livre',
      name: 'Lu Andrade',
    })

    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUrl:
          'events-expo://activate?inviter=Bruno%20Reis&group=Vocal%20Livre&name=Lu%20Andrade',
      }),
    )
  })

  it('sends no redirect url when none is configured', async () => {
    const issuer = new ClerkInvitationIssuer({
      secretKey: 'sk_test',
      redirectUrl: null,
      ttlDays: 7,
    })

    await issuer.issue('lu@x.com', { name: 'Lu' })

    expect(createInvitation.mock.calls[0]?.[0]).not.toHaveProperty('redirectUrl')
  })
})
