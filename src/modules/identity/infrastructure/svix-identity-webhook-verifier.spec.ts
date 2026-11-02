import { Webhook } from 'svix'
import { describe, expect, it } from 'vitest'
import type { WebhookRequest } from '../application/ports/identity-webhook-verifier.js'
import { SvixIdentityWebhookVerifier } from './svix-identity-webhook-verifier.js'

const SECRET = `whsec_${Buffer.from('unit-test-webhook-signing-secret').toString('base64')}`
const OTHER_SECRET = `whsec_${Buffer.from('another-webhook-signing-secret!!').toString('base64')}`

function signed(payload: unknown, secret = SECRET): WebhookRequest {
  const body = JSON.stringify(payload)
  const id = 'msg_test'
  const timestamp = new Date()
  return {
    rawBody: Buffer.from(body),
    headers: {
      'svix-id': id,
      'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'svix-signature': new Webhook(secret).sign(id, timestamp, body),
    },
  }
}

function userUpdated(data: Record<string, unknown> = {}) {
  return {
    type: 'user.updated',
    object: 'event',
    data: {
      id: 'user_ana',
      first_name: 'Ana',
      last_name: 'Souza',
      primary_email_address_id: 'idn_primary',
      email_addresses: [
        { id: 'idn_other', email_address: 'old@example.com', verification: { status: 'verified' } },
        {
          id: 'idn_primary',
          email_address: 'ana@example.com',
          verification: { status: 'verified' },
        },
      ],
      ...data,
    },
  }
}

describe('SvixIdentityWebhookVerifier', () => {
  const verifier = new SvixIdentityWebhookVerifier(SECRET)

  it('reads a user.updated: Clerk id, full name and the verified primary email', () => {
    expect(verifier.verify(signed(userUpdated()))).toEqual({
      type: 'USER_UPDATED',
      externalId: 'user_ana',
      name: 'Ana Souza',
      email: 'ana@example.com',
    })
  })

  it('answers a null name when Clerk has neither first nor last name', () => {
    const event = verifier.verify(signed(userUpdated({ first_name: null, last_name: '' })))

    expect(event).toMatchObject({ type: 'USER_UPDATED', name: null })
  })

  it('answers a null email when the primary one is missing or unverified', () => {
    const unverified = userUpdated()
    unverified.data.email_addresses[1]!.verification.status = 'unverified'

    for (const payload of [unverified, userUpdated({ primary_email_address_id: null })]) {
      expect(verifier.verify(signed(payload))).toMatchObject({ type: 'USER_UPDATED', email: null })
    }
  })

  it('answers IGNORED for a verified event of another type', () => {
    expect(verifier.verify(signed({ type: 'user.created', data: { id: 'user_ana' } }))).toEqual({
      type: 'IGNORED',
    })
  })

  it('answers null for a user.updated without the Clerk id', () => {
    expect(verifier.verify(signed(userUpdated({ id: undefined })))).toBeNull()
  })

  it('answers null without the signature headers', () => {
    const request = signed(userUpdated())

    expect(verifier.verify({ ...request, headers: {} })).toBeNull()
  })

  it('answers null for a signature of another secret', () => {
    expect(verifier.verify(signed(userUpdated(), OTHER_SECRET))).toBeNull()
  })

  it('answers null for a body changed after signing', () => {
    const request = signed(userUpdated())
    const tampered = Buffer.from(request.rawBody.toString().replace('Ana', 'Eva'))

    expect(verifier.verify({ ...request, rawBody: tampered })).toBeNull()
  })

  it('fails loudly without a signing secret, instead of refusing every webhook', () => {
    expect(() => new SvixIdentityWebhookVerifier(null).verify(signed(userUpdated()))).toThrow(
      /CLERK_WEBHOOK_SIGNING_SECRET/,
    )
  })
})
