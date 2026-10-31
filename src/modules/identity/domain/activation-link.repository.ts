import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ActivationLink, NewActivationLinkProps } from './activation-link.entity.js'

export abstract class ActivationLinkRepository {
  /** Creates the User's link and drops any previous one: one active link per User. */
  abstract replaceForUser(props: NewActivationLinkProps, stamp: Stamp): Promise<ActivationLink>
  /** Drops the User's link, if any. */
  abstract deleteForUser(userId: number): Promise<void>
}
