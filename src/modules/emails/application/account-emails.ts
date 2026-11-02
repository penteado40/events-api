import type { BackgroundTasks } from '../../../shared/application/background-tasks.js'
import type { Clock } from '../../../shared/application/clock.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EmailKind } from '../domain/email-log.js'
import type { EmailLogRepository } from '../domain/email-log.repository.js'
import type { EmailSender, OutgoingEmail } from './ports/email-sender.js'
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
      this.attempt('ACCOUNT_ACTIVATION_LINK', to.email, stamp, () => ({
        from: { name: this.platform.platformName, address: this.platform.fromAddress },
        to: to.email,
        ...accountActivationLinkText({
          platformName: this.platform.platformName,
          name: to.name,
          url: link.url,
          expiresAt: link.expiresAt,
        }),
      })),
    )
  }

  /** One attempt, recorded in the Email log whatever the outcome. */
  private async attempt(
    kind: EmailKind,
    recipient: string,
    stamp: Stamp,
    compose: () => OutgoingEmail,
  ): Promise<void> {
    let error: string | null = null
    try {
      await this.sender.send(compose())
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
    const status = error === null ? 'SENT' : 'FAILED'
    try {
      await this.log.record(
        { kind, recipient, status, error },
        { by: stamp.by, at: this.clock.now() },
      )
    } catch (cause) {
      throw new Error(`Email log não gravou a tentativa ${kind} para ${recipient} (${status})`, {
        cause,
      })
    }
  }
}
