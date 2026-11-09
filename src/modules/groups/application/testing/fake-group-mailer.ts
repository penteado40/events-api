import type { Stamp } from '../../../../shared/domain/stamp.js'
import {
  GroupMailer,
  type GroupMailGroup,
  type GroupMailInviter,
  type GroupMailRecipient,
} from '../ports/group-mailer.js'
import type { GroupActivationLink } from '../ports/group-user-accounts.js'

export interface SentGroupEmail {
  kind: 'GROUP_ACTIVATION_LINK' | 'GROUP_ACCESS'
  group: GroupMailGroup
  to: GroupMailRecipient
  /** Only on the Activation link of a Group. */
  link: GroupActivationLink | null
  inviter: GroupMailInviter
  stamp: Stamp
}

/** Keeps every email it was asked to send, in order. */
export class FakeGroupMailer extends GroupMailer {
  readonly sent: SentGroupEmail[] = []

  sendActivationLink(
    group: GroupMailGroup,
    to: GroupMailRecipient,
    link: GroupActivationLink,
    inviter: GroupMailInviter,
    stamp: Stamp,
  ): void {
    this.sent.push({ kind: 'GROUP_ACTIVATION_LINK', group, to, link, inviter, stamp })
  }

  sendGroupAccess(
    group: GroupMailGroup,
    to: GroupMailRecipient,
    inviter: GroupMailInviter,
    stamp: Stamp,
  ): void {
    this.sent.push({ kind: 'GROUP_ACCESS', group, to, link: null, inviter, stamp })
  }
}
