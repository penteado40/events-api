import { AppError } from '../../../../shared/domain/app-error.js'
import type { Stamp } from '../../../../shared/domain/stamp.js'
import {
  type IssuedActivationLink,
  type FoundOrCreatedUser,
  MemberAccounts,
} from '../ports/member-accounts.js'
import type { FakeUserDirectory } from './fake-user-directory.js'

/** Writes into the FakeUserDirectory, so the use cases read back what they created. */
export class FakeMemberAccounts extends MemberAccounts {
  /** userId → the token of their live Activation link. */
  readonly links = new Map<number, string>()
  private sequence = 0
  private nextUserId = 1000

  constructor(private readonly directory: FakeUserDirectory) {
    super()
  }

  async findOrCreatePending(
    input: { email: string; name: string },
    stamp: Stamp,
  ): Promise<FoundOrCreatedUser> {
    const email = input.email.trim().toLowerCase()
    const found = this.directory.all().find((u) => u.email === email)
    if (found) return { user: found, activation: null }

    const user = this.directory.add({
      id: this.nextUserId++,
      name: input.name.trim(),
      email,
      isPending: true,
    })
    return { user, activation: this.issue(user.id, stamp) }
  }

  async reissueActivationLink(userId: number, stamp: Stamp): Promise<IssuedActivationLink> {
    const user = await this.directory.findById(userId)
    if (!user) throw new AppError('NOT_FOUND')
    if (!user.isPending) throw new AppError('USER_ALREADY_ACTIVE')
    return this.issue(userId, stamp)
  }

  async dropPendingActivation(userId: number): Promise<void> {
    if ((await this.directory.findById(userId))?.isPending) this.links.delete(userId)
  }

  private issue(userId: number, stamp: Stamp): IssuedActivationLink {
    this.sequence += 1
    const activationToken = `token-${this.sequence}`
    this.links.set(userId, activationToken)
    return { activationToken, expiresAt: new Date(stamp.at.getTime() + 7 * 24 * 3600_000) }
  }
}
