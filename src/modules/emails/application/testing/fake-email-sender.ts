import { EmailSender, type OutgoingEmail } from '../ports/email-sender.js'

/** Keeps every email it accepted in `sent`; `failNextSend` makes the next one throw, as the provider would. */
export class FakeEmailSender extends EmailSender {
  readonly sent: OutgoingEmail[] = []
  private failing = false

  async send(email: OutgoingEmail): Promise<void> {
    if (this.failing) {
      this.failing = false
      throw new Error('fake email sender: send failed')
    }
    this.sent.push(email)
  }

  failNextSend(): void {
    this.failing = true
  }
}
