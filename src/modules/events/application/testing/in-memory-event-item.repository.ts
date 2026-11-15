import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { EventItemAudience } from '../../domain/event-item-audience.vo.js'
import { EventItem, type NewEventItemProps } from '../../domain/event-item.entity.js'
import { EventItemRepository } from '../../domain/event-item.repository.js'

export class InMemoryEventItemRepository extends EventItemRepository {
  private readonly items = new Map<number, EventItem>()
  private nextId = 1

  async findInEvent(eventId: number, itemId: number): Promise<EventItem | null> {
    const item = this.items.get(itemId)
    return item?.eventId === eventId ? item : null
  }

  async lockInEvent(eventId: number, itemId: number): Promise<EventItem | null> {
    return this.findInEvent(eventId, itemId)
  }

  async findAllInEvent(eventId: number): Promise<EventItem[]> {
    return this.ofEvent(eventId)
  }

  async create(props: NewEventItemProps, stamp: Stamp): Promise<EventItem> {
    const item = EventItem.restore({
      id: this.nextId++,
      eventId: props.eventId,
      name: props.name.value,
      start: props.start,
      place: props.place,
      state: props.state,
      position: props.position,
      audience: EventItemAudience.all(),
      ...createdWith(stamp),
    })
    this.items.set(item.id, item)
    return item
  }

  async save(item: EventItem): Promise<void> {
    this.items.set(item.id, item)
  }

  async delete(itemId: number): Promise<void> {
    this.items.delete(itemId)
  }

  async removeFromAudiences(eventId: number, userId: number): Promise<void> {
    for (const item of this.ofEvent(eventId)) {
      if (!item.audience.userIds.includes(userId)) continue
      const audience = EventItemAudience.selected(
        item.audience.userIds.filter((id) => id !== userId),
      )
      // Rebuilt from its props, as the database row is written apart from the entity.
      this.items.set(item.id, EventItem.restore({ ...propsOf(item), audience }))
    }
  }

  /** The Event items of the Event, in the order of creation. Helper for the reader and for assertions. */
  ofEvent(eventId: number): EventItem[] {
    return [...this.items.values()].filter((i) => i.eventId === eventId).sort((a, b) => a.id - b.id)
  }
}

function propsOf(item: EventItem) {
  return {
    id: item.id,
    eventId: item.eventId,
    name: item.name,
    start: item.start,
    place: item.place,
    state: item.state,
    position: item.position,
    audience: item.audience,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdById: item.createdById,
    updatedById: item.updatedById,
  }
}
