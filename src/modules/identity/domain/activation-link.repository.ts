import type { ActivationLink, NewActivationLinkProps } from './activation-link.entity.js'
import type { User } from './user.entity.js'

export abstract class ActivationLinkRepository {
  /** Creates the User's link and drops any previous one: one active link per User. */
  abstract replaceForUser(props: NewActivationLinkProps): Promise<ActivationLink>
  abstract findByTokenHash(tokenHash: string): Promise<ActivationLink | null>
  /**
   * Atomically marks the link used and saves the activated User. Returns false,
   * saving nothing, when the link was used meanwhile (two concurrent clicks).
   */
  abstract completeActivation(link: ActivationLink, user: User, at: Date): Promise<boolean>
}
