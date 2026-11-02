import { Injectable } from '@nestjs/common'
import { Resend } from 'resend'
import { EmailSender, type OutgoingEmail } from '../application/ports/email-sender.js'

/** Emails through Resend, from the Platform sender's verified domain (ADR-0006). */
@Injectable()
export class ResendEmailSender extends EmailSender {
  private client: Resend | null = null

  /** Null outside production when unset: every attempt then fails into the Email log. */
  constructor(private readonly apiKey: string | null) {
    super()
  }

  async send(email: OutgoingEmail): Promise<void> {
    const { error } = await this.resend().emails.send({
      from: `"${email.from.name.replaceAll('"', '')}" <${email.from.address}>`,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    if (error) throw new Error(`Resend recusou o email: ${error.name}: ${error.message}`)
  }

  private resend(): Resend {
    if (!this.apiKey) throw new Error('RESEND_API_KEY não definida: sem ela nenhum email sai')
    this.client ??= new Resend(this.apiKey)
    return this.client
  }
}
