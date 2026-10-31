import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { ActivationLink, type NewActivationLinkProps } from '../../domain/activation-link.entity.js'
import { ActivationLinkRepository } from '../../domain/activation-link.repository.js'

export class InMemoryActivationLinkRepository extends ActivationLinkRepository {
  private readonly links = new Map<number, ActivationLink>()
  private nextId = 1
  private failing = false

  async replaceForUser(props: NewActivationLinkProps, stamp: Stamp): Promise<ActivationLink> {
    if (this.failing) {
      this.failing = false
      throw new Error('in-memory activation links: replace failed')
    }
    await this.deleteForUser(props.userId)
    const link = ActivationLink.restore({ ...props, id: this.nextId++, ...createdWith(stamp) })
    this.links.set(link.id, link)
    return link
  }

  async findForUser(userId: number): Promise<ActivationLink | null> {
    return [...this.links.values()].find((l) => l.userId === userId) ?? null
  }

  async deleteForUser(userId: number): Promise<void> {
    for (const link of this.links.values()) {
      if (link.userId === userId) this.links.delete(link.id)
    }
  }

  /** The next replace throws, as the database going away would. */
  failNextReplace(): void {
    this.failing = true
  }

  all(): ActivationLink[] {
    return [...this.links.values()]
  }
}
