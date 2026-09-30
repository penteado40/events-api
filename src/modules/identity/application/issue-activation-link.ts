import { AppError } from '../../../shared/domain/app-error.js'
import type { Email } from '../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ActivationLinkRepository } from '../domain/activation-link.repository.js'
import type { User } from '../domain/user.entity.js'
import type { UserRepository } from '../domain/user.repository.js'
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

/** Creates a Pending user and their first Activation link, both by the stamp's Author. */
export async function createPendingUser(
  users: UserRepository,
  links: ActivationLinkRepository,
  tokens: ActivationTokenGenerator,
  props: { name: string; email: Email },
  stamp: Stamp,
  options: ActivationLinkOptions,
): Promise<{ user: User; link: IssuedActivationLink }> {
  const user = await users.create(
    { name: props.name.trim(), email: props.email, passwordHash: null, role: 'USER' },
    stamp,
  )
  const link = await issueActivationLink(links, tokens, user.id, stamp, options)
  return { user, link }
}

/** Reissues the link of a Pending user: NOT_FOUND without the User, USER_ALREADY_ACTIVE once active. */
export async function reissueActivationLink(
  users: UserRepository,
  links: ActivationLinkRepository,
  tokens: ActivationTokenGenerator,
  userId: number,
  stamp: Stamp,
  options: ActivationLinkOptions,
): Promise<IssuedActivationLink> {
  const user = await users.findById(userId)
  if (!user) throw new AppError('NOT_FOUND')
  if (!user.isPending) throw new AppError('USER_ALREADY_ACTIVE')
  return issueActivationLink(links, tokens, user.id, stamp, options)
}
