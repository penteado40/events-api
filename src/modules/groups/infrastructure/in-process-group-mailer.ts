import type { Stamp } from '../../../shared/domain/stamp.js'
import type { GroupEmails } from '../../emails/index.js'
import {
  GroupMailer,
  type GroupMailGroup,
  type GroupMailInviter,
  type GroupMailRecipient,
} from '../application/ports/group-mailer.js'
import type { GroupActivationLink } from '../application/ports/group-user-accounts.js'

/** The GroupMailer port over the emails the emails context offers other contexts. */
export class InProcessGroupMailer extends GroupMailer {
  constructor(private readonly emails: GroupEmails) {
    super()
  }

  sendActivationLink(
    group: GroupMailGroup,
    to: GroupMailRecipient,
    link: GroupActivationLink,
    inviter: GroupMailInviter,
    stamp: Stamp,
  ): void {
    this.emails.sendActivationLink(group, to, link, inviter, stamp)
  }

  sendGroupAccess(
    group: GroupMailGroup,
    to: GroupMailRecipient,
    inviter: GroupMailInviter,
    stamp: Stamp,
  ): void {
    this.emails.sendGroupAccess(group, to, inviter, stamp)
  }
}
