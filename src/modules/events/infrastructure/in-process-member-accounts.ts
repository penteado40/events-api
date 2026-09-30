import { Injectable } from '@nestjs/common'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { UserAccounts } from '../../identity/index.js'
import {
  type IssuedActivationLink,
  type FoundOrCreatedUser,
  MemberAccounts,
} from '../application/ports/member-accounts.js'

/** Writes Users through the UserAccounts that the identity context exports. */
@Injectable()
export class InProcessMemberAccounts extends MemberAccounts {
  constructor(private readonly accounts: UserAccounts) {
    super()
  }

  findOrCreatePending(
    input: { email: string; name: string },
    stamp: Stamp,
  ): Promise<FoundOrCreatedUser> {
    return this.accounts.findOrCreatePending(input, stamp)
  }

  reissueActivationLink(userId: number, stamp: Stamp): Promise<IssuedActivationLink> {
    return this.accounts.reissueActivationLink(userId, stamp)
  }

  dropPendingActivation(userId: number): Promise<void> {
    return this.accounts.dropPendingActivation(userId)
  }
}
