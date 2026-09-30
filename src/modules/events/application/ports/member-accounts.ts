import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { DirectoryUser } from './user-directory.js'

export interface IssuedActivationLink {
  activationToken: string
  expiresAt: Date
}

export interface FoundOrCreatedUser {
  user: DirectoryUser
  /** Only for a Pending user created just now. */
  activation: IssuedActivationLink | null
}

/** The writes on Users that adding and removing Event members needs, owned by identity. */
export abstract class MemberAccounts {
  /** Finds the User by email, or creates a Pending user with an Activation link. */
  abstract findOrCreatePending(
    input: { email: string; name: string },
    stamp: Stamp,
  ): Promise<FoundOrCreatedUser>
  /** A fresh link for a Pending user; throws USER_ALREADY_ACTIVE otherwise. */
  abstract reissueActivationLink(userId: number, stamp: Stamp): Promise<IssuedActivationLink>
  /** Drops the link of a User who is still pending; no-op otherwise. */
  abstract dropPendingActivation(userId: number): Promise<void>
}
