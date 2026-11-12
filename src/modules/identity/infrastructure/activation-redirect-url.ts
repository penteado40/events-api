import type { InvitationRedirect } from '../application/ports/invitation-issuer.js'

/** Every field of the redirect, in query order; the type fails to compile if one is missing. */
const QUERY_KEYS: Record<keyof InvitationRedirect, true> = {
  inviter: true,
  group: true,
  name: true,
}

/**
 * The invitation's redirect url: the configured base plus what the app shows
 * on the activation screen as encoded query parameters (Clerk then adds
 * `__clerk_ticket` and `__clerk_status`). Empty values are left out; trimming
 * is the caller's job.
 */
export function activationRedirectUrl(base: string, redirect: InvitationRedirect): string {
  const query = (Object.keys(QUERY_KEYS) as (keyof InvitationRedirect)[])
    .flatMap((key) => {
      const value = redirect[key]
      return value ? [`${key}=${encodeURIComponent(value)}`] : []
    })
    .join('&')
  if (!query) return base
  // The query goes before a fragment, if the base has one.
  const hash = base.indexOf('#')
  const path = hash === -1 ? base : base.slice(0, hash)
  const fragment = hash === -1 ? '' : base.slice(hash)
  return `${path}${path.includes('?') ? '&' : '?'}${query}${fragment}`
}
