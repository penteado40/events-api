import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ActivationLinkRepository } from '../domain/activation-link.repository.js'
import type { ActivationTokenGenerator } from './ports/activation-token-generator.js'

export interface ActivationLinkOptions {
  /** Lifetime of a new Activation link, in seconds. */
  ttlSeconds: number
}

export interface IssuedActivationLink {
  activationToken: string
  expiresAt: Date
}

/** Issues a fresh link for the User, invalidating the previous one; it expires counting from the stamp. */
export async function issueActivationLink(
  links: ActivationLinkRepository,
  tokens: ActivationTokenGenerator,
  userId: number,
  stamp: Stamp,
  options: ActivationLinkOptions,
): Promise<IssuedActivationLink> {
  const expiresAt = new Date(stamp.at.getTime() + options.ttlSeconds * 1000)
  const { token, tokenHash } = tokens.generate()
  await links.replaceForUser({ userId, tokenHash, expiresAt }, stamp)
  return { activationToken: token, expiresAt }
}
