import type { BackgroundTasks } from '../../../shared/application/background-tasks.js'
import type { Clock } from '../../../shared/application/clock.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EmailLogRepository } from '../domain/email-log.repository.js'
import type { EmailSender } from './ports/email-sender.js'
import { sendAndLog } from './send-and-log.js'
import { accountActivationLinkText } from './texts/account-activation-link.js'

export interface PlatformSender {
  platformName: string
  fromAddress: string
}

export interface AccountEmailRecipient {
  email: string
  name: string
}

export interface ActivationLinkToSend {
  url: string
  expiresAt: Date
}

/** The account's emails (glossary: Email kind), sent from the Platform sender. */
export class AccountEmails {
  constructor(
    private readonly sender: EmailSender,
    private readonly log: EmailLogRepository,
    private readonly background: BackgroundTasks,
    private readonly clock: Clock,
    private readonly platform: PlatformSender,
  ) {}

  /**
   * Sends the Activation link after the response, so nothing about the email
   * (its text, the provider) can undo the User: a failure lands in the Email log.
   */
  sendActivationLink(to: AccountEmailRecipient, link: ActivationLinkToSend, stamp: Stamp): void {
    this.background.run(() =>
      sendAndLog(
        { sender: this.sender, log: this.log, clock: this.clock },
        'ACCOUNT_ACTIVATION_LINK',
        to.email,
        stamp,
        () => ({
          from: { name: this.platform.platformName, address: this.platform.fromAddress },
          to: to.email,
          ...accountActivationLinkText({
            platformName: this.platform.platformName,
            name: to.name,
            url: link.url,
            expiresAt: link.expiresAt,
          }),
        }),
      ),
    )
  }
}
