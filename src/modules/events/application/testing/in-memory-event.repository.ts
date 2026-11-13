import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { Event, type NewEventProps } from '../../domain/event.entity.js'
import { EventRepository } from '../../domain/event.repository.js'

export class InMemoryEventRepository extends EventRepository {
  private readonly events = new Map<number, Event>()
  private nextId = 1

  async findById(id: number): Promise<Event | null> {
    return this.events.get(id) ?? null
  }

  async findByGroup(groupId: number): Promise<Event[]> {
    return [...this.events.values()]
      .filter((e) => e.groupId === groupId)
      .sort(
        (a, b) => a.period.startDate.value.localeCompare(b.period.startDate.value) || a.id - b.id,
      )
  }

  async create(props: NewEventProps, stamp: Stamp): Promise<Event> {
    const event = Event.restore({
      id: this.nextId++,
      groupId: props.groupId,
      name: props.name.value,
      place: props.place.value,
      period: props.period,
      state: 'DRAFT',
      ...createdWith(stamp),
    })
    this.events.set(event.id, event)
    return event
  }

  async save(event: Event): Promise<void> {
    this.events.set(event.id, event)
  }
}
