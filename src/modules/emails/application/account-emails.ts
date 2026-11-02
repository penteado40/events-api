import type { BackgroundTasks } from '../../../shared/application/background-tasks.js'
import type { Clock } from '../../../shared/application/clock.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EmailKind, EmailLogRepository } from '../domain/email-log.js'
import type { EmailSender, OutgoingEmail } from './ports/email-sender.js'
import { accountActivationLinkText } from './texts/account-activation-link.text.js'

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
   * Sends the Activation link after the response, so a provider failure never
   * undoes the User: it only lands in the Email log.
   */
  sendActivationLink(to: AccountEmailRecipient, link: ActivationLinkToSend, stamp: Stamp): void {
    const email = {
      from: { name: this.platform.platformName, address: this.platform.fromAddress },
      to: to.email,
      ...accountActivationLinkText({
        platformName: this.platform.platformName,
        name: to.name,
        url: link.url,
        expiresAt: link.expiresAt,
      }),
    }
    this.background.run(() => this.attempt('ACCOUNT_ACTIVATION_LINK', email, stamp.by))
  }

  /** One attempt, recorded in the Email log whatever the outcome. */
  private async attempt(kind: EmailKind, email: OutgoingEmail, by: number | null): Promise<void> {
    let error: string | null = null
    try {
      await this.sender.send(email)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
    await this.log.record(
      { kind, recipient: email.to, status: error === null ? 'SENT' : 'FAILED', error },
      { by, at: this.clock.now() },
    )
  }
}
