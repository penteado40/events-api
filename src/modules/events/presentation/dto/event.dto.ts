import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { EVENT_STATES } from '../../domain/event.entity.js'
import { EVENT_NAME_MAX_LENGTH } from '../../domain/event-name.vo.js'
import { EVENT_PLACE_MAX_LENGTH } from '../../domain/event-place.vo.js'

// The domain checks them again (EventName, EventPlace, EventPeriod); here they are for the 400 and the docs.
const eventNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(EVENT_NAME_MAX_LENGTH)
  .meta({ example: 'Shows em Manaus' })

const eventPlaceSchema = z.string().trim().min(1).max(EVENT_PLACE_MAX_LENGTH).meta({
  description: 'Onde, em texto livre: uma cidade ou um local.',
  example: 'Manaus - AM',
})

/** The period travels as written, with no conversion (ADR-0016). */
const EventPeriodSchema = z.strictObject({
  startDate: z.iso.date().meta({
    description: 'Primeiro dia do Event (data de calendário, sem hora).',
    example: '2026-11-13',
  }),
  endDate: z.iso.date().meta({
    description:
      'Último dia do Event, igual ou depois de startDate (senão 400 EVENT_PERIOD_INVALID).',
    example: '2026-11-16',
  }),
  timezone: z.string().min(1).max(64).meta({
    description:
      'Fuso IANA padrão do lugar, com o nome canônico exato (America/Manaus, UTC); abreviação, alias antigo, outra caixa ou espaços em volta: 400 VALIDATION_ERROR. Volta como enviado, e as datas nunca são convertidas para UTC.',
    example: 'America/Manaus',
  }),
})

/** Public shape of an Event. */
const EventJsonSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  groupId: z.number().int().meta({ example: 1 }),
  name: z.string().meta({ example: 'Shows em Manaus' }),
  place: z.string().meta({ example: 'Manaus - AM' }),
  period: z.object({
    startDate: z.iso.date().meta({ example: '2026-11-13' }),
    endDate: z.iso.date().meta({ example: '2026-11-16' }),
    timezone: z.string().meta({ example: 'America/Manaus' }),
  }),
  state: z.enum(EVENT_STATES).meta({ example: 'DRAFT' }),
  isFinished: z.boolean().meta({
    description: 'Finished event: a data final já passou no fuso do Event. Continua editável.',
    example: false,
  }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type EventJson = z.infer<typeof EventJsonSchema>

export class CreateEventDto extends createZodDto(
  z.strictObject({ name: eventNameSchema, place: eventPlaceSchema, period: EventPeriodSchema }),
) {}

export class EditEventDto extends createZodDto(
  z
    .strictObject({
      name: eventNameSchema.optional(),
      place: eventPlaceSchema.optional(),
      period: EventPeriodSchema.optional().meta({
        description: 'O período inteiro, trocado de uma vez.',
      }),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Envie ao menos um campo.' }),
) {}

export class EventResponseDto extends createZodDto(z.object({ data: EventJsonSchema })) {}

export class EventListResponseDto extends createZodDto(
  z.object({ data: z.array(EventJsonSchema) }),
) {}
