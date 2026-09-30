import type { Event } from '../domain/event.entity.js'
import type { EventWithMembership } from '../domain/event.repository.js'
import type { EventJson, PublicEventJson } from './dto/event.dto.js'

export const EventPresenter = {
  toJson({ event, membership }: EventWithMembership): EventJson {
    return {
      id: event.id,
      type: event.type,
      status: event.status,
      name: event.name,
      slug: event.slug.value,
      siteUrl: event.siteUrl.value,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      timezone: event.timezone,
      locale: event.locale,
      currency: event.currency,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      city: event.city,
      mapsUrl: event.mapsUrl,
      membership: membership ? { ...membership } : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    }
  },

  /** Field by field, so nothing internal slips in when the Event grows. */
  toPublicJson(event: Event): PublicEventJson {
    return {
      id: event.id,
      type: event.type,
      status: event.status,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      timezone: event.timezone,
      locale: event.locale,
      currency: event.currency,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      city: event.city,
      mapsUrl: event.mapsUrl,
    }
  },
}
