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

  async replaceForUser(props: NewActivationLinkProps): Promise<ActivationLink> {
    for (const link of this.links.values()) {
      if (link.userId === props.userId) this.links.delete(link.id)
    }
    const link = ActivationLink.restore({
      ...props,
      id: this.nextId++,
      usedAt: null,
      createdAt: new Date(),
    })
    this.links.set(link.id, link)
    return link
  }

  async findByTokenHash(tokenHash: string): Promise<ActivationLink | null> {
    return [...this.links.values()].find((l) => l.tokenHash === tokenHash) ?? null
  }

  async completeActivation(link: ActivationLink, user: User, at: Date): Promise<ActivationOutcome> {
    const stored = this.links.get(link.id)
    if (!stored) return 'replaced'
    if (stored.isUsed) return 'used'
    this.links.set(link.id, ActivationLink.restore({ ...snapshot(stored), usedAt: at }))
    await this.users.save(user)
    return 'activated'
  }

  /** Marks a link used, as a concurrent activation would. */
  markUsed(tokenHash: string, at = new Date()): void {
    const link = [...this.links.values()].find((l) => l.tokenHash === tokenHash)
    if (link) this.links.set(link.id, ActivationLink.restore({ ...snapshot(link), usedAt: at }))
  }

  all(): ActivationLink[] {
    return [...this.links.values()]
  }
}

function snapshot(link: ActivationLink) {
  return {
    id: link.id,
    userId: link.userId,
    tokenHash: link.tokenHash,
    expiresAt: link.expiresAt,
    usedAt: link.usedAt,
    createdAt: link.createdAt,
  }
}
