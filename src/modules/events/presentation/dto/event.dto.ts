import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { EVENT_ROLES } from '../../domain/event-member.js'
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, SLUG_PATTERN } from '../../domain/slug.vo.js'
import { CURRENCIES, EVENT_STATUSES, EVENT_TYPES, LOCALES } from '../../domain/event.entity.js'

/** ISO 8601 with an explicit offset (ADR-0008); `Z` counts as one. */
const dateTime = z.iso.datetime({ offset: true })
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional()

// The examples create an Event that works against the local environment.
const EventDetailsSchema = z.object({
  type: z.enum(EVENT_TYPES).meta({ example: 'WEDDING' }),
  name: z.string().trim().min(1).max(200).meta({ example: 'Casamento de Ana e Bruno' }),
  startsAt: dateTime.meta({ example: '2027-05-15T16:00:00-03:00' }),
  endsAt: dateTime.nullable().optional().meta({ example: '2027-05-15T23:00:00-03:00' }),
  timezone: z
    .string()
    .max(64)
    .meta({ description: 'Nome IANA. Padrão: America/Sao_Paulo.', example: 'America/Sao_Paulo' }),
  locale: z.enum(LOCALES).meta({ example: 'pt-BR' }),
  venueName: optionalText(200).meta({ example: 'Espaço Jardim' }),
  venueAddress: optionalText(500).meta({ example: 'Rua das Flores, 100' }),
  city: optionalText(120).meta({ example: 'São Paulo' }),
  mapsUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable()
    .optional()
    .meta({ example: 'https://maps.app.goo.gl/exemplo' }),
})

const siteUrl = z.string().trim().min(1).max(2048).meta({
  description:
    'Origem do Site: `https://host[:porta]`, sem caminho. `http://localhost` só fora de produção.',
  example: 'http://localhost:5173',
})

export class CreateEventDto extends createZodDto(
  EventDetailsSchema.extend({
    slug: z.string().min(SLUG_MIN_LENGTH).max(SLUG_MAX_LENGTH).regex(SLUG_PATTERN).meta({
      description: 'Permanente: kebab-case, de 3 a 60 caracteres.',
      example: 'ana-e-bruno',
    }),
    siteUrl,
    timezone: EventDetailsSchema.shape.timezone.optional(),
    locale: EventDetailsSchema.shape.locale.optional(),
    currency: z.enum(CURRENCIES).optional().meta({ example: 'BRL' }),
    primaryOwnerUserId: z.number().int().positive().nullable().optional().meta({
      description:
        'Um User existente que não seja Super admin. Opcional: sem ele, o Event nasce sem Primary owner.',
      example: null,
    }),
  }),
) {}

/** slug, currency and status never change here; unknown fields are refused. */
export class UpdateEventDto extends createZodDto(
  z.strictObject({ ...EventDetailsSchema.partial().shape, siteUrl: siteUrl.optional() }),
) {}

export class ListEventsQueryDto extends createZodDto(
  z.object({ status: z.enum(EVENT_STATUSES).optional().meta({ example: 'ACTIVE' }) }),
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
  membership: z
    .object({ role: z.enum(EVENT_ROLES), isPrimaryOwner: z.boolean() })
    .nullable()
    .meta({ description: 'A Membership de quem fez a requisição; null para o Super admin.' }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type EventJson = z.infer<typeof EventJsonSchema>

export class EventResponseDto extends createZodDto(z.object({ data: EventJsonSchema })) {}

export class EventListResponseDto extends createZodDto(
  z.object({ data: z.array(EventJsonSchema) }),
) {}

/** What the Site reads: the happening, never how the Event is run. */
export const PublicEventJsonSchema = EventJsonSchema.pick({
  id: true,
  type: true,
  status: true,
  name: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  locale: true,
  currency: true,
  venueName: true,
  venueAddress: true,
  city: true,
  mapsUrl: true,
})

export type PublicEventJson = z.infer<typeof PublicEventJsonSchema>

export class PublicEventResponseDto extends createZodDto(
  z.object({ data: PublicEventJsonSchema }),
) {}
