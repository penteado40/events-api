import type { EventWithMembership } from '../domain/event.repository.js'
import type { EventJson } from './dto/event.dto.js'

export const EventPresenter = {
  toJson({ event, membership }: EventWithMembership): EventJson {
    return {
      id: event.id,
      type: event.type,
      status: event.status,
      name: event.name,
      slug: event.slug,
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
}
