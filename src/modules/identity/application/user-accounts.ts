import { AppError } from '../../../shared/domain/app-error.js'
import { Email } from '../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ActivationLinkRepository } from '../domain/activation-link.repository.js'
import type { UserRepository } from '../domain/user.repository.js'
import {
  type ActivationLinkOptions,
  createPendingUser,
  type IssuedActivationLink,
  reissueActivationLink,
} from './issue-activation-link.js'
import type { ActivationTokenGenerator } from './ports/activation-token-generator.js'
import { toUserSummary, type UserSummary } from './user-lookup.js'

export interface FoundOrCreatedUser {
  user: UserSummary
  /** Only for a User created just now; an existing User is never touched. */
  activation: IssuedActivationLink | null
}

/**
 * The writes on Users that identity offers other contexts: adding an Event
 * member by email, and managing a Pending user's Activation link. Who may do
 * it is the caller's call; a User and their link belong to the platform, not
 * to any Event.
 */
export class UserAccounts {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly tokens: ActivationTokenGenerator,
    private readonly options: ActivationLinkOptions,
  ) {}

  async findOrCreatePending(
    input: { email: string; name: string },
    stamp: Stamp,
  ): Promise<FoundOrCreatedUser> {
    const email = Email.create(input.email)
    const found = await this.users.findByEmail(email)
    if (found) return { user: toUserSummary(found), activation: null }

    try {
      const { user, link } = await createPendingUser(
        this.users,
        this.links,
        this.tokens,
        { name: input.name, email },
        stamp,
        this.options,
      )
      return { user: toUserSummary(user), activation: link }
    } catch (error) {
      // Someone created the same email meanwhile: it is an existing User now.
      if (!(error instanceof AppError && error.code === 'EMAIL_ALREADY_IN_USE')) throw error
      const winner = await this.users.findByEmail(email)
      if (!winner) throw error
      return { user: toUserSummary(winner), activation: null }
    }
  }

  /** A fresh link for a Pending user; the previous one stops working. */
  async reissueActivationLink(userId: number, stamp: Stamp): Promise<IssuedActivationLink> {
    return reissueActivationLink(this.users, this.links, this.tokens, userId, stamp, this.options)
  }

  /** Drops a Pending user's link, so nobody activates an account with no purpose. */
  async dropPendingActivation(userId: number): Promise<void> {
    const user = await this.users.findById(userId)
    if (user?.isPending) await this.links.deleteForUser(user.id)
  }
}
