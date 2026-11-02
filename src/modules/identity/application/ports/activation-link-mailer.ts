import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { IssuedActivationLink } from '../issue-activation-link.js'

/**
 * Emails the account's Activation link to the Pending user. It only schedules
 * the email: a failure to deliver never reaches the caller.
 */
export abstract class ActivationLinkMailer {
  abstract send(to: { email: string; name: string }, link: IssuedActivationLink, stamp: Stamp): void
}
