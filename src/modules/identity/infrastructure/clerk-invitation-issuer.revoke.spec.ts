import { ClerkAPIResponseError } from '@clerk/backend/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClerkInvitationIssuer } from './clerk-invitation-issuer.js'

const revokeInvitation = vi.fn()

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({ invitations: { revokeInvitation } }),
}))

function clerkError(status: number, code: string): ClerkAPIResponseError {
  return new ClerkAPIResponseError('clerk', {
    status,
    data: [{ code, message: code, long_message: code }],
  })
}

/** How the adapter reads Clerk's answers to a revoke, with the client stubbed. */
describe('ClerkInvitationIssuer.revoke', () => {
  const issuer = new ClerkInvitationIssuer({ secretKey: 'sk_test', redirectUrl: null, ttlDays: 1 })

  beforeEach(() => {
    revokeInvitation.mockReset()
  })

  it('revokes through Clerk', async () => {
    revokeInvitation.mockResolvedValue({})

    await expect(issuer.revoke('inv_1')).resolves.toBeUndefined()
    expect(revokeInvitation).toHaveBeenCalledWith('inv_1')
  })

  it.each([
    [400, 'revoked_invitation'],
    [404, 'resource_not_found'],
  ])('treats %i %s as already revoked', async (status, code) => {
    revokeInvitation.mockRejectedValue(clerkError(status, code))

    await expect(issuer.revoke('inv_1')).resolves.toBeUndefined()
  })

  it.each([
    [400, 'form_param_missing'],
    [404, 'revoked_invitation'],
    [422, 'resource_not_found'],
    [500, 'internal_clerk_error'],
  ])('still throws %i %s', async (status, code) => {
    const error = clerkError(status, code)
    revokeInvitation.mockRejectedValue(error)

    await expect(issuer.revoke('inv_1')).rejects.toBe(error)
  })

  it('still throws an error that is not from the Clerk API', async () => {
    const error = new Error('network down')
    revokeInvitation.mockRejectedValue(error)

    await expect(issuer.revoke('inv_1')).rejects.toBe(error)
  })
})
