import { Injectable } from '@nestjs/common'
import type { Stamp } from '../../../shared/domain/stamp.js'
import { AccountEmails } from '../../emails/index.js'
import type { IssuedActivationLink } from '../application/issue-activation-link.js'
import { ActivationLinkMailer } from '../application/ports/activation-link-mailer.js'

/** The account's Activation link email, sent by the emails context in this process. */
@Injectable()
export class InProcessActivationLinkMailer extends ActivationLinkMailer {
  constructor(private readonly emails: AccountEmails) {
    super()
  }

  send(to: { email: string; name: string }, link: IssuedActivationLink, stamp: Stamp): void {
    this.emails.sendActivationLink(to, link, stamp)
  }
}
