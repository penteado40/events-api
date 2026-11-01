import type { Stamp } from '../../../../shared/domain/stamp.js'

/** A User as the groups context sees them (identity's UserSummary fits). */
export interface GroupUser {
  id: number
  name: string
  email: string
  isSuperAdmin: boolean
  isPending: boolean
}

/** The Activation link of a Pending user, for whoever gave them a role to pass on. */
export interface GroupActivationLink {
  url: string
  expiresAt: Date
}

export interface EnsuredGroupUser {
  user: GroupUser
  /** Only for a Pending user created just now. */
  activationLink: GroupActivationLink | null
}

/** The Users behind the Group members: identity's UserAccounts, seen from groups. */
export abstract class GroupUserAccounts {
  /** The User of the email, created as a Pending user with an Activation link when there is none. */
  abstract ensureUser(
    input: { email: string; name: string; phone: string },
    stamp: Stamp,
  ): Promise<EnsuredGroupUser>
  /** Revokes a Pending user's Activation link, so no usable link outlives a failed write. */
  abstract dropPendingActivation(userId: number): Promise<void>
}
