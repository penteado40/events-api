import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { EVENT_ITEM_STATES } from '../../domain/event-item.entity.js'
import { EVENT_ITEM_NAME_MAX_LENGTH } from '../../domain/event-item-name.vo.js'
import { isEventItemOrder } from '../../domain/event-item-order.js'
import {
  EVENT_ITEM_PLACE_ADDRESS_MAX_LENGTH,
  EVENT_ITEM_PLACE_NAME_MAX_LENGTH,
} from '../../domain/event-item-place.vo.js'
import { timezoneSchema } from './event.dto.js'

// The domain checks them again (EventItemName, EventItemStart, EventItemPlace); here they are for the 400 and the docs.
const itemNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(EVENT_ITEM_NAME_MAX_LENGTH)
  .meta({ example: 'Passagem de som' })

const itemDateSchema = z.iso.date().nullable().meta({
  description:
    'Dia do Event item no calendário do lugar (sem hora), mesmo fora do período do Event. Sem data, o item vai para a General info.',
  example: '2026-11-14',
})

const itemTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .meta({
    description:
      'Hora de início local (HH:mm), nunca convertida. Só com data: hora sem data é 400 EVENT_ITEM_TIME_WITHOUT_DATE.',
    example: '15:00',
  })

const itemPlaceSchema = z
  .strictObject({
    name: z.string().max(EVENT_ITEM_PLACE_NAME_MAX_LENGTH).nullable().optional().meta({
      example: 'Teatro Amazonas',
    }),
    address: z.string().max(EVENT_ITEM_PLACE_ADDRESS_MAX_LENGTH).nullable().optional().meta({
      example: 'Largo de São Sebastião, s/n - Centro, Manaus - AM',
    }),
    timezone: timezoneSchema.nullable().optional().meta({
      description:
        'Fuso IANA do lugar, com o nome exato (America/Manaus). Sem ele, vale o fuso padrão do Event.',
      example: 'America/Manaus',
    }),
  })
  .nullable()
  .meta({
    description:
      'Onde o Event item acontece: nome, endereço e fuso, cada um opcional, mas não todos vazios.',
  })

const placeJsonSchema = z
  .object({
    name: z.string().nullable().meta({ example: 'Teatro Amazonas' }),
    address: z.string().nullable().meta({ example: 'Largo de São Sebastião, s/n - Centro' }),
    timezone: z.string().nullable().meta({
      description: 'O fuso do lugar como escrito; null quando vale o do Event.',
      example: 'America/Manaus',
    }),
  })
  .nullable()

/** When an item starts, as written: date, time and zone of the place, never converted (ADR-0016). */
const whenJsonSchema = z
  .object({
    date: z.iso.date().meta({ example: '2026-11-14' }),
    time: z
      .string()
      .nullable()
      .meta({ description: 'HH:mm local; null quando só o dia é conhecido.', example: '15:00' }),
    timezone: z.string().meta({
      description: 'O fuso do lugar do item ou, sem ele, o do Event. Só rotula a hora.',
      example: 'America/Manaus',
    }),
  })
  .nullable()
  .meta({ description: 'null para um item da General info (sem data).' })

/** An Event item as the schedule shows it. */
const scheduleItemJsonSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  name: z.string().meta({ example: 'Passagem de som' }),
  when: whenJsonSchema,
  place: placeJsonSchema,
  state: z.enum(EVENT_ITEM_STATES).meta({ example: 'PUBLISHED' }),
})

export type ScheduleItemJson = z.infer<typeof scheduleItemJsonSchema>

/** Public shape of an Event item, as a write returns it. */
const eventItemJsonSchema = scheduleItemJsonSchema.extend({
  eventId: z.number().int().meta({ example: 1 }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type EventItemJson = z.infer<typeof eventItemJsonSchema>

const scheduleJsonSchema = z.object({
  generalInfo: z.array(scheduleItemJsonSchema).meta({
    description: 'Os Event items sem data, na ordem da produção.',
  }),
  timeline: z
    .array(
      z.object({
        date: z.iso.date().meta({ example: '2026-11-14' }),
        items: z.array(scheduleItemJsonSchema),
      }),
    )
    .meta({
      description:
        'Só os dias com Event items, em ordem de data, mesmo fora do período. Em cada dia, primeiro os sem hora, na ordem da produção, depois os com hora, pela hora e, na mesma hora, na ordem da produção.',
    }),
})

export type ScheduleJson = z.infer<typeof scheduleJsonSchema>

export class CreateEventItemDto extends createZodDto(
  z.strictObject({
    name: itemNameSchema,
    date: itemDateSchema.optional(),
    time: itemTimeSchema.optional(),
    place: itemPlaceSchema.optional(),
  }),
) {}

export class EditEventItemDto extends createZodDto(
  z
    .strictObject({
      name: itemNameSchema.optional(),
      date: itemDateSchema
        .optional()
        .meta({ description: 'null apaga a data (e exige apagar a hora).' }),
      time: itemTimeSchema.optional().meta({ description: 'null apaga a hora.' }),
      place: itemPlaceSchema.optional().meta({
        description: 'O lugar inteiro, trocado de uma vez; null apaga.',
      }),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Envie ao menos um campo.' }),
) {}

export class ReorderEventItemsDto extends createZodDto(
  z.strictObject({
    itemIds: z
      .array(z.number().int().positive())
      .refine(isEventItemOrder, { message: 'Ao menos um Event item, cada um uma vez.' })
      .meta({
        description:
          'Os ids de todos os Event items empatados, onde a hora não decide (todos sem data, todos do mesmo dia sem hora ou todos do mesmo dia e hora), na nova ordem.',
        example: [12, 10, 11],
      }),
  }),
) {}

export class EventItemResponseDto extends createZodDto(z.object({ data: eventItemJsonSchema })) {}

export class ScheduleResponseDto extends createZodDto(z.object({ data: scheduleJsonSchema })) {}
