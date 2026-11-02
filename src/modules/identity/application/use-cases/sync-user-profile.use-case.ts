import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { IdentityWebhookEvent } from '../ports/identity-webhook-verifier.js'

/** A verified webhook from the identity provider. */
export type SyncUserProfileInput = IdentityWebhookEvent

/**
 * - `UPDATED`: the mirror changed.
 * - `UNCHANGED`: nothing to change, the User was not touched.
 * - `UNKNOWN_USER`: no User is linked to that provider user; nothing is created.
 * - `EMAIL_IN_USE`: another User has the new email, so only the name changed.
 * - `IGNORED`: an event we do not act on.
 */
export type SyncUserProfileOutput =
  'UPDATED' | 'UNCHANGED' | 'UNKNOWN_USER' | 'EMAIL_IN_USE' | 'IGNORED'

/**
 * Keeps the mirror of a User's name and email in step with the identity
 * provider, from its webhook (ADR-0020). Never creates a User nor a link:
 * those are born only at the first sign-in. The write has no Author, as an
 * automatic process (ADR-0013).
 */
export class SyncUserProfileUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SyncUserProfileInput): Promise<SyncUserProfileOutput> {
    if (input.type === 'IGNORED') return 'IGNORED'
    const user = await this.users.findByClerkId(input.externalId)
    if (!user) return 'UNKNOWN_USER'

    const stamp: Stamp = { by: null, at: this.clock.now() }
    const name = input.name ?? undefined
    const wanted = toEmail(input.email)
    const emailInUse = wanted !== undefined && (await this.isEmailOfAnotherUser(wanted, user))
    const email = emailInUse ? undefined : wanted

    const before = { name: user.name, email: user.email }
    if (!user.mirrorProfile({ name, email }, stamp))
      return emailInUse ? 'EMAIL_IN_USE' : 'UNCHANGED'
    try {
      await this.users.save(user)
    } catch (error) {
      if (!(error instanceof AppError && error.code === 'EMAIL_ALREADY_IN_USE')) throw error
      // Another User took the email between the check and the write.
      await this.mirrorOnlyTheName(user, before, stamp)
      return 'EMAIL_IN_USE'
    }
    return emailInUse ? 'EMAIL_IN_USE' : 'UPDATED'
  }

  private async isEmailOfAnotherUser(email: Email, user: User): Promise<boolean> {
    const owner = await this.users.findByEmail(email)
    return owner !== null && owner.id !== user.id
  }

  /** Puts the email back as it was, and stores the name if that changed. */
  private async mirrorOnlyTheName(
    user: User,
    before: { name: string; email: Email },
    stamp: Stamp,
  ): Promise<void> {
    user.mirrorProfile({ email: before.email }, stamp)
    if (user.name !== before.name) await this.users.save(user)
  }
}

function toEmail(raw: string | null): Email | undefined {
  if (raw === null) return undefined
  try {
    return Email.create(raw)
  } catch {
    return undefined
  }
}
