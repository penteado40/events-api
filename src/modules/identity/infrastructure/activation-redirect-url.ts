import type { InvitationRedirect } from '../application/ports/invitation-issuer.js'

const PARAMETERS = ['inviter', 'group', 'name'] as const

/**
 * The invitation's redirect url: the configured base plus what the app shows
 * on the activation screen as encoded query parameters (Clerk then adds
 * `__clerk_ticket` and `__clerk_status`). Blank values are left out.
 */
export function activationRedirectUrl(base: string, redirect: InvitationRedirect): string {
  const query = PARAMETERS.flatMap((key) => {
    const value = redirect[key]?.trim()
    return value ? [`${key}=${encodeURIComponent(value)}`] : []
  }).join('&')
  if (!query) return base
  return `${base}${base.includes('?') ? '&' : '?'}${query}`
}
