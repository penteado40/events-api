import { Injectable } from '@nestjs/common'
import {
  type Event as PrismaEvent,
  type EventMember as PrismaEventMember,
  Prisma,
} from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import {
  CURRENCIES,
  type Currency,
  Event,
  LOCALES,
  type Locale,
  type NewEventProps,
} from '../domain/event.entity.js'
import type { Membership } from '../domain/event-member.js'
import {
  type EventListFilter,
  EventRepository,
  type EventWithMembership,
} from '../domain/event.repository.js'
import { SiteUrl } from '../domain/site-url.vo.js'
import { Slug } from '../domain/slug.vo.js'

const NEWEST_FIRST = [
  { startsAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.EventOrderByWithRelationInput[]

@Injectable()
export class PrismaEventRepository extends EventRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findById(id: number): Promise<Event | null> {
    const row = await this.prisma.event.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findBySlug(slug: Slug): Promise<Event | null> {
    const row = await this.prisma.event.findUnique({ where: { slug: slug.value } })
    return row ? toDomain(row) : null
  }

  async create(
    props: NewEventProps,
    primaryOwnerUserId: number | null,
    stamp: Stamp,
  ): Promise<Event> {
    try {
      const row = await this.prisma.event.create({
        data: {
          ...toRow(props),
          slug: props.slug.value,
          currency: props.currency,
          ...createdWith(stamp),
          members:
            primaryOwnerUserId === null
              ? undefined
              : {
                  create: {
                    userId: primaryOwnerUserId,
                    role: 'OWNER',
                    isPrimaryOwner: true,
                    ...createdWith(stamp),
                  },
                },
        },
      })
      return toDomain(row)
    } catch (error) {
      // The use case checks first; this covers two concurrent creations.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('SLUG_ALREADY_IN_USE')
      }
      throw error
    }
  }

  async save(event: Event): Promise<void> {
    await this.prisma.event.update({
      where: { id: event.id },
      // The entity keeps its own updatedAt, so the response matches what is stored.
      data: {
        ...toRow(event),
        status: event.status,
        updatedAt: event.updatedAt,
        updatedById: event.updatedById,
      },
    })
  }

  async listAll(filter: EventListFilter): Promise<Event[]> {
    const rows = await this.prisma.event.findMany({
      where: { status: filter.status },
      orderBy: NEWEST_FIRST,
    })
    return rows.map(toDomain)
  }

  async listForMember(userId: number, filter: EventListFilter): Promise<EventWithMembership[]> {
    const rows = await this.prisma.event.findMany({
      where: { status: filter.status, members: { some: { userId } } },
      include: { members: { where: { userId } } },
      orderBy: NEWEST_FIRST,
    })
    return rows.map(({ members, ...row }) => ({
      event: toDomain(row),
      membership: members[0] ? toMembership(members[0]) : null,
    }))
  }

  async findMembership(eventId: number, userId: number): Promise<Membership | null> {
    const row = await this.prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    return row ? toMembership(row) : null
  }
}

/** The columns that the Event's edits may change (slug and currency never do). */
function toRow(event: Omit<NewEventProps, 'slug' | 'currency'>) {
  return {
    type: event.type,
    name: event.name,
    siteUrl: event.siteUrl.value,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    locale: event.locale,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    city: event.city,
    mapsUrl: event.mapsUrl,
  }
}

function toDomain(row: PrismaEvent): Event {
  return Event.restore({
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    slug: Slug.restore(row.slug),
    siteUrl: SiteUrl.restore(row.siteUrl),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    locale: oneOf(LOCALES, row.locale) as Locale,
    currency: oneOf(CURRENCIES, row.currency) as Currency,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    city: row.city,
    mapsUrl: row.mapsUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}

function toMembership(row: PrismaEventMember): Membership {
  return { role: row.role, isPrimaryOwner: row.isPrimaryOwner }
}

function oneOf(allowed: readonly string[], value: string): string {
  if (!allowed.includes(value)) throw new Error(`Unexpected stored value: ${value}`)
  return value
}
