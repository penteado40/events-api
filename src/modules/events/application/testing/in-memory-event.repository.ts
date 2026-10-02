import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { Event, type NewEventProps } from '../../domain/event.entity.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import {
  EventMember,
  type Membership,
  type NewEventMemberProps,
} from '../../domain/event-member.js'
import type { Slug } from '../../domain/slug.vo.js'
import {
  type EventListFilter,
  EventRepository,
  type EventWithMembership,
} from '../../domain/event.repository.js'

export class InMemoryEventRepository extends EventRepository {
  private readonly events = new Map<number, Event>()
  private readonly members = new Map<string, EventMember>()
  private nextId = 1
  /** Makes `listSiteUrls` throw, as a database outage would. */
  failListSiteUrls = false

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
      this.store(event.id, primaryOwnerUserId, { role: 'OWNER', isPrimaryOwner: true }, stamp)
    }
    return event
  }

  async save(event: Event): Promise<void> {
    this.events.set(event.id, event)
  }

  async listAll(filter: EventListFilter): Promise<Event[]> {
    return sortNewestFirst([...this.events.values()].filter((e) => matches(e, filter)))
  }

  async listSiteUrls(): Promise<string[]> {
    if (this.failListSiteUrls) throw new Error('database unavailable')
    return [...new Set([...this.events.values()].map((e) => e.siteUrl.value))]
  }

  async listForMember(userId: number, filter: EventListFilter): Promise<EventWithMembership[]> {
    const events = sortNewestFirst(
      [...this.events.values()].filter(
        (e) => this.members.has(key(e.id, userId)) && matches(e, filter),
      ),
    )
    return events.map((event) => ({
      event,
      membership: this.members.get(key(event.id, userId))?.membership ?? null,
    }))
  }

  async findMembership(eventId: number, userId: number): Promise<Membership | null> {
    return this.members.get(key(eventId, userId))?.membership ?? null
  }

  async listMembers(eventId: number): Promise<EventMember[]> {
    return [...this.members.values()].filter((m) => m.eventId === eventId).map(copy)
  }

  async findMember(eventId: number, userId: number): Promise<EventMember | null> {
    const member = this.members.get(key(eventId, userId))
    return member ? copy(member) : null
  }

  async createMember(props: NewEventMemberProps, stamp: Stamp): Promise<EventMember> {
    if (this.members.has(key(props.eventId, props.userId))) {
      throw new AppError('MEMBER_ALREADY_EXISTS')
    }
    return this.store(
      props.eventId,
      props.userId,
      { role: props.role, isPrimaryOwner: false },
      stamp,
    )
  }

  async saveMember(member: EventMember): Promise<void> {
    this.assertUnchanged(member)
    this.members.set(key(member.eventId, member.userId), copy(member))
  }

  async deleteMember(member: EventMember): Promise<void> {
    this.assertUnchanged(member)
    this.members.delete(key(member.eventId, member.userId))
  }

  async savePrimaryOwnerChange(former: EventMember | null, next: EventMember): Promise<void> {
    // Both checked before either is stored, like the transaction.
    if (former) this.assertUnchanged(former)
    this.assertUnchanged(next)
    if (former) await this.saveMember(former)
    await this.saveMember(next)
  }

  async countMembershipsOf(userId: number): Promise<number> {
    return [...this.members.values()].filter((m) => m.userId === userId).length
  }

  /** Like the conditional writes of the real repository (ADR-0014). */
  private assertUnchanged(member: EventMember): void {
    const stored = this.members.get(key(member.eventId, member.userId))
    const loaded = member.loadedMembership
    if (!stored || stored.role !== loaded.role || stored.isPrimaryOwner !== loaded.isPrimaryOwner) {
      throw new AppError('MEMBER_CHANGED')
    }
  }

  /** Test arrangement: links a User to an Event, written by the Super admin. */
  addMember(eventId: number, userId: number, membership: Membership): EventMember {
    return this.store(eventId, userId, membership, ARRANGE_STAMP)
  }

  private store(
    eventId: number,
    userId: number,
    membership: Membership,
    stamp: Stamp,
  ): EventMember {
    const member = EventMember.restore({ eventId, userId, ...membership, ...createdWith(stamp) })
    this.members.set(key(eventId, userId), member)
    return member
  }

  all(): Event[] {
    return [...this.events.values()]
  }
}

/** Each read gets its own entity, as each request would from the database. */
function copy(member: EventMember): EventMember {
  return EventMember.restore({
    eventId: member.eventId,
    userId: member.userId,
    role: member.role,
    isPrimaryOwner: member.isPrimaryOwner,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    createdById: member.createdById,
    updatedById: member.updatedById,
  })
}

const ARRANGE_STAMP: Stamp = { by: 1, at: new Date('2026-09-01T12:00:00.000Z') }

function key(eventId: number, userId: number): string {
  return `${eventId}:${userId}`
}

function matches(event: Event, filter: EventListFilter): boolean {
  return filter.status === undefined || event.status === filter.status
}

function sortNewestFirst(events: Event[]): Event[] {
  return events.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
}
