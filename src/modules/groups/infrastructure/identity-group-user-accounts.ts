import type { Stamp } from '../../../shared/domain/stamp.js'
import type { UserAccounts } from '../../identity/index.js'
import {
  type EnsuredGroupUser,
  GroupUserAccounts,
} from '../application/ports/group-user-accounts.js'

/** The GroupUserAccounts port over the commands identity offers other contexts. */
export class IdentityGroupUserAccounts extends GroupUserAccounts {
  constructor(private readonly accounts: UserAccounts) {
    super()
  }

  ensureUser(
    input: { email: string; name: string; phone: string },
    stamp: Stamp,
  ): Promise<EnsuredGroupUser> {
    return this.accounts.ensureUser(input, stamp)
  }

  dropPendingActivation(userId: number): Promise<void> {
    return this.accounts.dropPendingActivation(userId)
  }
}
