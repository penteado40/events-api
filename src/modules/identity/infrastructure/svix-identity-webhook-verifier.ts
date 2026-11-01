import { Injectable } from '@nestjs/common'
import { Webhook, WebhookVerificationError } from 'svix'
import {
  type IdentityWebhookEvent,
  IdentityWebhookVerifier,
  type WebhookRequest,
} from '../application/ports/identity-webhook-verifier.js'

const SIGNATURE_HEADERS = ['svix-id', 'svix-timestamp', 'svix-signature'] as const

/**
 * Verifies Clerk's webhooks, signed by Svix (ADR-0020), over the raw body.
 * Svix also refuses a timestamp out of its tolerance, so an old request
 * cannot be replayed.
 */
@Injectable()
export class SvixIdentityWebhookVerifier extends IdentityWebhookVerifier {
  /** @param signingSecret the endpoint's `whsec_...`; null fails every webhook as a server error. */
  constructor(private readonly signingSecret: string | null) {
    super()
  }

  verify(request: WebhookRequest): IdentityWebhookEvent | null {
    if (!this.signingSecret) {
      throw new Error(
        'CLERK_WEBHOOK_SIGNING_SECRET não definida: sem ela o webhook não se verifica',
      )
    }
    const headers: Record<string, string> = {}
    for (const name of SIGNATURE_HEADERS) {
      const value = request.headers[name]
      if (typeof value !== 'string') return null
      headers[name] = value
    }
    try {
      // Since svix 2.x it only checks the signature, without parsing the body.
      new Webhook(this.signingSecret).verify(request.rawBody, headers)
    } catch (error) {
      if (error instanceof WebhookVerificationError) return null
      throw error
    }
    try {
      return toEvent(JSON.parse(request.rawBody.toString('utf8')))
    } catch {
      return null
    }
  }
}

interface ClerkEmailAddress {
  id?: unknown
  email_address?: unknown
  verification?: { status?: unknown } | null
}

function toEvent(payload: unknown): IdentityWebhookEvent | null {
  if (!isRecord(payload)) return null
  if (payload['type'] !== 'user.updated') return { type: 'IGNORED' }
  const data = payload['data']
  if (!isRecord(data) || typeof data['id'] !== 'string' || data['id'] === '') return null
  return {
    type: 'USER_UPDATED',
    externalId: data['id'],
    name: fullName(data['first_name'], data['last_name']),
    email: verifiedPrimaryEmail(data['primary_email_address_id'], data['email_addresses']),
  }
}

function fullName(first: unknown, last: unknown): string | null {
  const parts = [first, last].filter((p): p is string => typeof p === 'string' && p.trim() !== '')
  return parts.length > 0 ? parts.map((p) => p.trim()).join(' ') : null
}

function verifiedPrimaryEmail(primaryId: unknown, addresses: unknown): string | null {
  if (typeof primaryId !== 'string' || !Array.isArray(addresses)) return null
  const primary = (addresses as ClerkEmailAddress[]).find((a) => isRecord(a) && a.id === primaryId)
  if (primary?.verification?.status !== 'verified') return null
  return typeof primary.email_address === 'string' ? primary.email_address : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
