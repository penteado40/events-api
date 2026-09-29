import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { Event, type NewEventProps } from '../../domain/event.entity.js'
import type { Membership } from '../../domain/event-member.js'
import type { Slug } from '../../domain/slug.vo.js'
import {
  type EventListFilter,
  EventRepository,
  type EventWithMembership,
} from '../../domain/event.repository.js'

export class InMemoryEventRepository extends EventRepository {
  private readonly events = new Map<number, Event>()
  private readonly members = new Map<string, Membership>()
  private nextId = 1

  async findById(id: number): Promise<Event | null> {
    return this.events.get(id) ?? null
  }

  async findBySlug(slug: Slug): Promise<Event | null> {
    return [...this.events.values()].find((e) => e.slug.equals(slug)) ?? null
  }

  async create(
    props: NewEventProps,
    primaryOwnerUserId: number | null,
    stamp: Stamp,
  ): Promise<Event> {
    const event = Event.restore({
      ...props,
      id: this.nextId++,
      status: 'ACTIVE',
      ...createdWith(stamp),
    })
    this.events.set(event.id, event)
    if (primaryOwnerUserId !== null) {
      this.addMember(event.id, primaryOwnerUserId, { role: 'OWNER', isPrimaryOwner: true })
    }
    return event
  }

  async save(event: Event): Promise<void> {
    this.events.set(event.id, event)
  }

  async listAll(filter: EventListFilter): Promise<Event[]> {
    return sortNewestFirst([...this.events.values()].filter((e) => matches(e, filter)))
  }

  async listForMember(userId: number, filter: EventListFilter): Promise<EventWithMembership[]> {
    const events = sortNewestFirst(
      [...this.events.values()].filter(
        (e) => this.members.has(key(e.id, userId)) && matches(e, filter),
      ),
    )
    return events.map((event) => ({
      event,
      membership: this.members.get(key(event.id, userId)) ?? null,
    }))
  }

  async findMembership(eventId: number, userId: number): Promise<Membership | null> {
    return this.members.get(key(eventId, userId)) ?? null
  }

  /** Test arrangement: member management arrives with PROJ-56. */
  addMember(eventId: number, userId: number, membership: Membership): void {
    this.members.set(key(eventId, userId), membership)
  }

  all(): Event[] {
    return [...this.events.values()]
  }
}

function key(eventId: number, userId: number): string {
  return `${eventId}:${userId}`
}

function matches(event: Event, filter: EventListFilter): boolean {
  return filter.status === undefined || event.status === filter.status
}

function sortNewestFirst(events: Event[]): Event[] {
  return events.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
}
