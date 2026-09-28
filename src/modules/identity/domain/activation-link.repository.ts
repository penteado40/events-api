import type { ActivationLink, NewActivationLinkProps } from './activation-link.entity.js'
import type { User } from './user.entity.js'

/** How an activation attempt ended once it reached the database. */
export type ActivationOutcome = 'activated' | 'used' | 'replaced'

export abstract class ActivationLinkRepository {
  /** Creates the User's link and drops any previous one: one active link per User. */
  abstract replaceForUser(props: NewActivationLinkProps): Promise<ActivationLink>
  abstract findByTokenHash(tokenHash: string): Promise<ActivationLink | null>
  /**
   * Atomically marks the link used and saves the activated User's password.
   * Saves nothing when the link was used meanwhile (`used`, two concurrent
   * clicks) or dropped by a reissue (`replaced`).
   *
   * Deliberate exception to "one transaction changes one aggregate"
   * (docs/arquitetura.md §2.2): consuming the link and setting the password
   * must succeed or fail together, or a concurrent click could activate twice
   * or leave a spent link with no password.
   */
  abstract completeActivation(
    link: ActivationLink,
    user: User,
    at: Date,
  ): Promise<ActivationOutcome>
}
