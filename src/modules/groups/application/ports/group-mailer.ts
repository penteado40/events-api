import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { GroupActivationLink } from './group-user-accounts.js'

export interface GroupMailGroup {
  name: string
}

/** Who gets the email: the person added to the Group. */
export interface GroupMailRecipient {
  email: string
  name: string
}

/** Who made the action: the answer to the email goes to them. */
export interface GroupMailInviter {
  email: string
}

/**
 * The emails the groups context asks for when someone enters a Group (glossary:
 * Email kind). Each only schedules the email: a failure to deliver never
 * reaches the caller.
 */
export abstract class GroupMailer {
  /** The Activation link of a Pending user just added to the Group. */
  abstract sendActivationLink(
    group: GroupMailGroup,
    to: GroupMailRecipient,
    link: GroupActivationLink,
    inviter: GroupMailInviter,
    stamp: Stamp,
  ): void
  /** The entry into the Group of a User who is already active. */
  abstract sendGroupAccess(
    group: GroupMailGroup,
    to: GroupMailRecipient,
    inviter: GroupMailInviter,
    stamp: Stamp,
  ): void
}
