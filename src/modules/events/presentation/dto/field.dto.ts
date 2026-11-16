import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { namesEachItemOnce } from '../../domain/event-item-order.js'
import {
  FIELD_KINDS,
  FIELD_NAME_MAX_LENGTH,
  FIELD_PEOPLE_MAX,
  FIELD_PERSON_NAME_MAX_LENGTH,
  FIELD_TEXT_MAX_LENGTH,
  isUserEntry,
  type PersonEntry,
} from '../../domain/field.entity.js'

// The domain checks them again (FieldName, FieldText, FieldPeople); here they are for the 400 and the docs.
const fieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(FIELD_NAME_MAX_LENGTH)
  .meta({ description: 'O nome do Field, escolhido pela produção.', example: 'Obs' })

const fieldTextSchema = z.string().max(FIELD_TEXT_MAX_LENGTH).meta({
  description:
    'O valor de um Field de texto, como escrito (lista, telefone e link também são texto); pode ser vazio.',
  example: 'despachar som',
})

const personEntrySchema = z.union([
  z.strictObject({ userId: z.number().int().positive().meta({ example: 2 }) }),
  z.strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(FIELD_PERSON_NAME_MAX_LENGTH)
      .meta({ description: 'Um nome solto, de quem não tem login.', example: 'Seu Raimundo' }),
  }),
])

/** Each User once, and each loose name once, ignoring case. */
function eachPersonOnce(people: readonly PersonEntry[]): boolean {
  const keys = people.map((p) => (isUserEntry(p) ? `u:${p.userId}` : `n:${p.name.toLowerCase()}`))
  return new Set(keys).size === keys.length
}

const fieldPeopleSchema = z
  .array(personEntrySchema)
  .max(FIELD_PEOPLE_MAX)
  .refine(eachPersonOnce, { message: 'Uma pessoa repetida.' })
  .meta({
    description:
      'As pessoas de um Field PEOPLE, numa só lista, na ordem em que aparecem: cada entrada é { userId }, um User, só entre os Participants do Event (senão 409 NOT_A_PARTICIPANT), ou { name }, um nome solto de quem não tem login (o motorista local), que só aparece ali. Cada uma uma vez; pode ser vazio. Quem está no Field como User está no Audience do item enquanto estiver nele; um nome solto nunca vira User e não alcança ninguém.',
    example: [{ userId: 2 }, { userId: 3 }, { name: 'Seu Raimundo' }],
  })

const fieldPersonJsonSchema = z.union([
  z.object({
    userId: z.number().int().meta({ example: 2 }),
    name: z.string().meta({ example: 'Matias' }),
  }),
  z.object({
    name: z.string().meta({
      description: 'Um nome solto: só o nome, sem telefone e sem User.',
      example: 'Seu Raimundo',
    }),
  }),
])

/** A Field as the schedule and its routes show it. */
export const fieldJsonSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  kind: z.enum(FIELD_KINDS).meta({
    description:
      'O tipo do Field, para sempre: um Field nunca mistura tipos. TEXT (lista, telefone e link também) ou PEOPLE.',
    example: 'TEXT',
  }),
  name: z.string().meta({ example: 'Obs' }),
  value: z.union([z.string(), z.array(fieldPersonJsonSchema)]).meta({
    description:
      'O valor do Field: num TEXT, o texto como escrito; num PEOPLE, as pessoas na ordem, um User com userId e nome, um nome solto só com o nome.',
    example: 'despachar som',
  }),
})

export type FieldJson = z.infer<typeof fieldJsonSchema>

/** A Field as a write returns it. */
const fieldWriteJsonSchema = fieldJsonSchema.extend({
  eventItemId: z.number().int().meta({ example: 1 }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type FieldWriteJson = z.infer<typeof fieldWriteJsonSchema>

export class CreateFieldDto extends createZodDto(
  z
    .strictObject({
      kind: z.enum(FIELD_KINDS).meta({
        description: 'O tipo com que o Field nasce e fica: TEXT, com value, ou PEOPLE, com people.',
        example: 'TEXT',
      }),
      name: fieldNameSchema,
      value: fieldTextSchema.optional(),
      people: fieldPeopleSchema.optional(),
    })
    .refine(
      (body) =>
        body.kind === 'TEXT'
          ? body.value !== undefined && body.people === undefined
          : body.people !== undefined && body.value === undefined,
      { message: 'Um Field TEXT leva value; um PEOPLE, people.' },
    ),
) {}

export class EditFieldDto extends createZodDto(
  z
    .strictObject({
      name: fieldNameSchema.optional(),
      value: fieldTextSchema.optional(),
      people: fieldPeopleSchema.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Envie ao menos um campo.' })
    .refine((body) => body.value === undefined || body.people === undefined, {
      message: 'Um Field nunca mistura tipos: value ou people.',
    }),
) {}

export class ReorderFieldsDto extends createZodDto(
  z.strictObject({
    fieldIds: z
      .array(z.number().int().positive())
      .min(1)
      .refine(namesEachItemOnce, { message: 'Um Field repetido.' })
      .meta({
        description: 'Os ids de todos os Fields do Event item, na nova ordem.',
        example: [3, 1, 2],
      }),
  }),
) {}

export class FieldResponseDto extends createZodDto(z.object({ data: fieldWriteJsonSchema })) {}

export class FieldsResponseDto extends createZodDto(
  z.object({ data: z.array(fieldWriteJsonSchema) }),
) {}
