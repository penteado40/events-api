import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { EventItem, type NewEventItemProps } from '../../domain/event-item.entity.js'
import type { EventItemPosition } from '../../domain/event-item-order.js'
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
    const last = Math.max(0, ...this.ofEvent(props.eventId).map((i) => i.position))
    const item = EventItem.restore({
      id: this.nextId++,
      eventId: props.eventId,
      name: props.name.value,
      start: props.start,
      place: props.place,
      state: 'PUBLISHED',
      position: last + 1,
      ...createdWith(stamp),
    })
    this.items.set(item.id, item)
    return item
  }

  async save(item: EventItem): Promise<void> {
    this.items.set(item.id, item)
  }

  async reposition(positions: readonly EventItemPosition[]): Promise<void> {
    for (const { id, position } of positions) {
      this.items.get(id)?.moveTo(position)
    }
  }

  async delete(itemId: number): Promise<void> {
    this.items.delete(itemId)
  }

  /** The Event items of the Event, in the order of creation. Helper for the reader and for assertions. */
  ofEvent(eventId: number): EventItem[] {
    return [...this.items.values()].filter((i) => i.eventId === eventId).sort((a, b) => a.id - b.id)
  }
}
