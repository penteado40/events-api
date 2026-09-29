import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { EVENT_ROLES } from '../../domain/event-member.js'
import { CURRENCIES, EVENT_STATUSES, EVENT_TYPES, LOCALES } from '../../domain/event.entity.js'

/** ISO 8601 with an explicit offset (ADR-0008); `Z` counts as one. */
const dateTime = z.iso.datetime({ offset: true })
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional()

const EventDetailsSchema = z.object({
  type: z.enum(EVENT_TYPES),
  name: z.string().trim().min(1).max(200),
  startsAt: dateTime,
  endsAt: dateTime.nullable().optional(),
  /** IANA name, e.g. America/Sao_Paulo. */
  timezone: z.string().max(64),
  locale: z.enum(LOCALES),
  venueName: optionalText(200),
  venueAddress: optionalText(500),
  city: optionalText(120),
  mapsUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable()
    .optional(),
})

/** Origin of the Site: https://host[:port], no path. */
const siteUrl = z.string().trim().min(1).max(2048)

export class CreateEventDto extends createZodDto(
  EventDetailsSchema.extend({
    /** Permanent: kebab-case, 3 to 60 characters. */
    slug: z
      .string()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    siteUrl,
    timezone: EventDetailsSchema.shape.timezone.optional(),
    locale: EventDetailsSchema.shape.locale.optional(),
    currency: z.enum(CURRENCIES).optional(),
    primaryOwnerUserId: z.number().int().positive().nullable().optional(),
  }),
) {}

/** slug, currency and status never change here; unknown fields are refused. */
export class UpdateEventDto extends createZodDto(
  z.strictObject({ ...EventDetailsSchema.partial().shape, siteUrl: siteUrl.optional() }),
) {}

export class ListEventsQueryDto extends createZodDto(
  z.object({ status: z.enum(EVENT_STATUSES).optional() }),
) {}

export const EventJsonSchema = z.object({
  id: z.number().int(),
  type: z.enum(EVENT_TYPES),
  status: z.enum(EVENT_STATUSES),
  name: z.string(),
  slug: z.string(),
  siteUrl: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timezone: z.string(),
  locale: z.enum(LOCALES),
  currency: z.enum(CURRENCIES),
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  city: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  /** The caller's link to the Event; null for the Super admin. */
  membership: z.object({ role: z.enum(EVENT_ROLES), isPrimaryOwner: z.boolean() }).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type EventJson = z.infer<typeof EventJsonSchema>

export class EventResponseDto extends createZodDto(z.object({ data: EventJsonSchema })) {}

export class EventListResponseDto extends createZodDto(
  z.object({ data: z.array(EventJsonSchema) }),
) {}
