import type { Stamp } from '../../../shared/domain/stamp.js'
import type { UserAccounts } from '../../identity/index.js'
import {
  type EnsuredGroupUser,
  type GroupUserContact,
  GroupUserAccounts,
} from '../application/ports/group-user-accounts.js'

/** The GroupUserAccounts port over the commands identity offers other contexts. */
export class InProcessGroupUserAccounts extends GroupUserAccounts {
  constructor(private readonly accounts: UserAccounts) {
    super()
  }

  ensureUser(contact: GroupUserContact, stamp: Stamp): Promise<EnsuredGroupUser> {
    return this.accounts.ensureUser(contact, stamp)
  }

  dropPendingActivation(userId: number): Promise<void> {
    return this.accounts.dropPendingActivation(userId)
  }
}
