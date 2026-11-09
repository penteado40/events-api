import type { BackgroundTasks } from '../../../shared/application/background-tasks.js'
import type { Clock } from '../../../shared/application/clock.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EmailKind } from '../domain/email-log.js'
import type { EmailLogRepository } from '../domain/email-log.repository.js'
import type { ActivationLinkToSend, PlatformSender } from './account-emails.js'
import type { EmailSender } from './ports/email-sender.js'
import { sendAndLog } from './send-and-log.js'
import { groupAccessText } from './texts/group-access.js'
import { groupActivationLinkText } from './texts/group-activation-link.js'
import type { EmailText } from './texts/shared.js'

export interface GroupEmailGroup {
  name: string
}

export interface GroupEmailRecipient {
  email: string
  name: string
}

/** Who made the action: the answer to the email goes to them. */
export interface GroupEmailInviter {
  email: string
}

/**
 * The emails of a Group (glossary: Email kind), sent from the Platform sender
 * under the name "<Group> via <Plataforma>", replying to who made the action.
 */
export class GroupEmails {
  constructor(
    private readonly sender: EmailSender,
    private readonly log: EmailLogRepository,
    private readonly background: BackgroundTasks,
    private readonly clock: Clock,
    private readonly platform: PlatformSender,
  ) {}

  /** The Activation link of a Pending user added to a Group, sent after the response. */
  sendActivationLink(
    group: GroupEmailGroup,
    to: GroupEmailRecipient,
    link: ActivationLinkToSend,
    inviter: GroupEmailInviter,
    stamp: Stamp,
  ): void {
    this.dispatch('GROUP_ACTIVATION_LINK', group, to, inviter, stamp, () =>
      groupActivationLinkText({
        platformName: this.platform.platformName,
        groupName: group.name,
        name: to.name,
        url: link.url,
        expiresAt: link.expiresAt,
      }),
    )
  }

  /** The entry into a Group of a User who is already active, sent after the response. */
  sendGroupAccess(
    group: GroupEmailGroup,
    to: GroupEmailRecipient,
    inviter: GroupEmailInviter,
    stamp: Stamp,
  ): void {
    this.dispatch('GROUP_ACCESS', group, to, inviter, stamp, () =>
      groupAccessText({
        platformName: this.platform.platformName,
        groupName: group.name,
        name: to.name,
      }),
    )
  }

  /** One email of a Group after the response: sender, recipient and replyTo are the same for every kind. */
  private dispatch(
    kind: EmailKind,
    group: GroupEmailGroup,
    to: GroupEmailRecipient,
    inviter: GroupEmailInviter,
    stamp: Stamp,
    text: () => EmailText,
  ): void {
    this.background.run(() =>
      sendAndLog(
        { sender: this.sender, log: this.log, clock: this.clock },
        kind,
        to.email,
        stamp,
        () => ({
          from: {
            name: `${group.name} via ${this.platform.platformName}`,
            address: this.platform.fromAddress,
          },
          to: to.email,
          replyTo: inviter.email,
          ...text(),
        }),
      ),
    )
  }
}
