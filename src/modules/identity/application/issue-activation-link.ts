import type { ActivationLinkRepository } from '../domain/activation-link.repository.js'
import type { ActivationTokenGenerator } from './ports/activation-token-generator.js'

export interface ActivationLinkOptions {
  /** Lifetime of a new Activation link, in seconds. */
  ttlSeconds: number
  now?: () => Date
}

export interface IssuedActivationLink {
  activationToken: string
  expiresAt: Date
}

/** Issues a fresh link for the User, invalidating the previous one. */
export async function issueActivationLink(
  links: ActivationLinkRepository,
  tokens: ActivationTokenGenerator,
  userId: number,
  options: ActivationLinkOptions,
): Promise<IssuedActivationLink> {
  const now = options.now?.() ?? new Date()
  const expiresAt = new Date(now.getTime() + options.ttlSeconds * 1000)
  const { token, tokenHash } = tokens.generate()
  await links.replaceForUser({ userId, tokenHash, expiresAt })
  return { activationToken: token, expiresAt }
}
