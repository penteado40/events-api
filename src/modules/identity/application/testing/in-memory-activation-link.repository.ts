import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { ActivationLink, type NewActivationLinkProps } from '../../domain/activation-link.entity.js'
import {
  ActivationLinkRepository,
  type ActivationOutcome,
} from '../../domain/activation-link.repository.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'

export class InMemoryActivationLinkRepository extends ActivationLinkRepository {
  private readonly links = new Map<number, ActivationLink>()
  private nextId = 1

  constructor(private readonly users: UserRepository) {
    super()
  }

  async replaceForUser(props: NewActivationLinkProps, stamp: Stamp): Promise<ActivationLink> {
    for (const link of this.links.values()) {
      if (link.userId === props.userId) this.links.delete(link.id)
    }
    const link = ActivationLink.restore({
      ...props,
      id: this.nextId++,
      usedAt: null,
      ...createdWith(stamp),
    })
    this.links.set(link.id, link)
    return link
  }

  async deleteForUser(userId: number): Promise<void> {
    for (const link of this.links.values()) {
      if (link.userId === userId) this.links.delete(link.id)
    }
  }

  async findByTokenHash(tokenHash: string): Promise<ActivationLink | null> {
    return [...this.links.values()].find((l) => l.tokenHash === tokenHash) ?? null
  }

  async completeActivation(
    link: ActivationLink,
    user: User,
    stamp: Stamp,
  ): Promise<ActivationOutcome> {
    const stored = this.links.get(link.id)
    if (!stored) return 'replaced'
    if (stored.isUsed) return 'used'
    this.links.set(link.id, used(stored, stamp))
    await this.users.save(user)
    return 'activated'
  }

  /** Marks a link used by its User, as a concurrent activation would. */
  markUsed(tokenHash: string): void {
    const link = [...this.links.values()].find((l) => l.tokenHash === tokenHash)
    if (link) this.links.set(link.id, used(link, { by: link.userId, at: link.createdAt }))
  }

  all(): ActivationLink[] {
    return [...this.links.values()]
  }
}

function used(link: ActivationLink, stamp: Stamp): ActivationLink {
  return ActivationLink.restore({
    id: link.id,
    userId: link.userId,
    tokenHash: link.tokenHash,
    expiresAt: link.expiresAt,
    usedAt: stamp.at,
    createdAt: link.createdAt,
    updatedAt: stamp.at,
    createdById: link.createdById,
    updatedById: stamp.by,
  })
}
