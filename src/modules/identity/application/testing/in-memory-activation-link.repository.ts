import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { ActivationLink, type NewActivationLinkProps } from '../../domain/activation-link.entity.js'
import { ActivationLinkRepository } from '../../domain/activation-link.repository.js'

export class InMemoryActivationLinkRepository extends ActivationLinkRepository {
  private readonly links = new Map<number, ActivationLink>()
  private nextId = 1

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

  all(): ActivationLink[] {
    return [...this.links.values()]
  }
}
