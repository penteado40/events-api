import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { UserRepository } from '../../domain/user.repository.js'

export interface SyncUserFromClerkInput {
  /** The Clerk user id, matched against the User's `clerkId`. */
  externalId: string
  /** The full name in Clerk; blank or null keeps the current one. */
  name: string | null
  /** The primary email in Clerk; null or invalid keeps the current one. */
  email: string | null
}

/**
 * - `UPDATED`: the mirror changed.
 * - `UNCHANGED`: nothing to change, the User was not touched.
 * - `UNKNOWN_USER`: no User is linked to that Clerk user; nothing is created.
 * - `EMAIL_IN_USE`: another User has the new email, so only the name changed.
 */
export type SyncUserFromClerkOutput = 'UPDATED' | 'UNCHANGED' | 'UNKNOWN_USER' | 'EMAIL_IN_USE'

/**
 * Keeps the mirror of a User's name and email in step with Clerk, from its
 * webhook (ADR-0020). Never creates a User nor a link: those are born only at
 * the first sign-in. The write has no Author, as an automatic process (ADR-0013).
 */
export class SyncUserFromClerkUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SyncUserFromClerkInput): Promise<SyncUserFromClerkOutput> {
    const user = await this.users.findByClerkId(input.externalId)
    if (!user) return 'UNKNOWN_USER'

    const stamp: Stamp = { by: null, at: this.clock.now() }
    const name = input.name ?? undefined
    let email = toEmail(input.email)
    let emailInUse = false
    if (email) {
      const owner = await this.users.findByEmail(email)
      if (owner && owner.id !== user.id) {
        email = undefined
        emailInUse = true
      }
    }

    const previous = { name: user.name, email: user.email }
    if (!user.mirrorClerkProfile({ name, email }, stamp)) {
      return emailInUse ? 'EMAIL_IN_USE' : 'UNCHANGED'
    }
    try {
      await this.users.save(user)
      return emailInUse ? 'EMAIL_IN_USE' : 'UPDATED'
    } catch (error) {
      // Another User took the email between the check and the write: keep the old one.
      if (!(error instanceof AppError && error.code === 'EMAIL_ALREADY_IN_USE')) throw error
      user.mirrorClerkProfile({ email: previous.email }, stamp)
      if (user.name !== previous.name) await this.users.save(user)
      return 'EMAIL_IN_USE'
    }
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
