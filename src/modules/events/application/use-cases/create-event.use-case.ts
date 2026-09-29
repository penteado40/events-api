import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import {
  type Currency,
  DEFAULT_TIMEZONE,
  Event,
  type EventType,
  type Locale,
  type NewEventProps,
} from '../../domain/event.entity.js'
import type { EventRepository, EventWithMembership } from '../../domain/event.repository.js'
import { SiteUrl, type SiteUrlOptions } from '../../domain/site-url.vo.js'
import { Slug } from '../../domain/slug.vo.js'
import type { UserDirectory } from '../ports/user-directory.js'
import type { Requester } from '../requester.js'

export interface CreateEventInput {
  actor: Requester
  type: EventType
  name: string
  slug: string
  siteUrl: string
  startsAt: Date
  endsAt?: Date | null
  timezone?: string
  locale?: Locale
  currency?: Currency
  venueName?: string | null
  venueAddress?: string | null
  city?: string | null
  mapsUrl?: string | null
  primaryOwnerUserId?: number | null
}

export type CreateEventOutput = EventWithMembership

/** The Super admin creates an Event, optionally naming its Primary owner. */
export class CreateEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserDirectory,
    private readonly siteUrlOptions: SiteUrlOptions,
  ) {}

  async execute(input: CreateEventInput): Promise<CreateEventOutput> {
    AccessPolicy.assert(
      { isSuperAdmin: input.actor.isSuperAdmin, membership: null },
      'event:create',
    )

    const props: NewEventProps = {
      type: input.type,
      name: input.name.trim(),
      slug: Slug.create(input.slug),
      siteUrl: SiteUrl.create(input.siteUrl, this.siteUrlOptions),
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: input.timezone ?? DEFAULT_TIMEZONE,
      locale: input.locale ?? 'pt-BR',
      currency: input.currency ?? 'BRL',
      venueName: input.venueName ?? null,
      venueAddress: input.venueAddress ?? null,
      city: input.city ?? null,
      mapsUrl: input.mapsUrl ?? null,
    }
    Event.validateNew(props)

    const primaryOwnerUserId = input.primaryOwnerUserId ?? null
    if (primaryOwnerUserId !== null) {
      // The Super admin is never an Event member.
      const user = await this.users.findById(primaryOwnerUserId)
      if (!user || user.isSuperAdmin) throw new AppError('PRIMARY_OWNER_INVALID')
    }
    if (await this.events.findBySlug(props.slug)) throw new AppError('SLUG_ALREADY_IN_USE')

    const event = await this.events.create(props, primaryOwnerUserId)
    return { event, membership: null }
  }
}
