import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { IssuedActivationLink } from '../issue-activation-link.js'
import {
  ActivationLinkMailer,
  type ActivationLinkRecipient,
} from '../ports/activation-link-mailer.js'

/** Keeps every Activation link it was asked to email in `sent`. */
export class FakeActivationLinkMailer extends ActivationLinkMailer {
  readonly sent: {
    to: ActivationLinkRecipient
    link: IssuedActivationLink
    stamp: Stamp
  }[] = []

  send(to: ActivationLinkRecipient, link: IssuedActivationLink, stamp: Stamp): void {
    this.sent.push({ to, link, stamp })
  }
}
