import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { IssuedActivationLink } from '../issue-activation-link.js'

/** Who receives the Activation link: the Pending user. */
export interface ActivationLinkRecipient {
  email: string
  name: string
}

/**
 * Emails the account's Activation link to the Pending user. It only schedules
 * the email: a failure to deliver never reaches the caller.
 */
export abstract class ActivationLinkMailer {
  abstract send(to: ActivationLinkRecipient, link: IssuedActivationLink, stamp: Stamp): void
}
