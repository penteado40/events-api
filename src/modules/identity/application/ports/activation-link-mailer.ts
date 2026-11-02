import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { User } from '../../domain/user.entity.js'
import type { IssuedActivationLink } from '../activation-links.js'

/** Who receives the Activation link: the Pending user. */
export interface ActivationLinkRecipient {
  email: string
  name: string
}

/** The User as the recipient of their own Activation link. */
export function recipientOf(user: User): ActivationLinkRecipient {
  return { email: user.email.value, name: user.name }
}

/**
 * Emails the account's Activation link to the Pending user. It only schedules
 * the email: a failure to deliver never reaches the caller.
 */
export abstract class ActivationLinkMailer {
  abstract send(to: ActivationLinkRecipient, link: IssuedActivationLink, stamp: Stamp): void
}
