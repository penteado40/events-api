import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { namesEachItemOnce } from '../../domain/event-item-order.js'
import {
  FIELD_KINDS,
  FIELD_NAME_MAX_LENGTH,
  FIELD_PEOPLE_MAX,
  FIELD_TEXT_MAX_LENGTH,
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

const fieldPeopleSchema = z
  .array(z.number().int().positive())
  .max(FIELD_PEOPLE_MAX)
  .refine(namesEachItemOnce, { message: 'Uma pessoa repetida.' })
  .meta({
    description:
      'Os User ids das pessoas de um Field PEOPLE, na ordem em que aparecem, cada uma uma vez, só entre os Participants do Event (senão 409 NOT_A_PARTICIPANT); pode ser vazio. Quem está no Field está no Audience do item enquanto estiver nele.',
    example: [2, 3],
  })

const fieldPersonJsonSchema = z.object({
  userId: z.number().int().meta({ example: 2 }),
  name: z.string().meta({ example: 'Matias' }),
})

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
      'O valor do Field: num TEXT, o texto como escrito; num PEOPLE, as pessoas com o nome, na ordem.',
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
        description:
          'O tipo com que o Field nasce e fica: TEXT, com value, ou PEOPLE, com userIds.',
        example: 'TEXT',
      }),
      name: fieldNameSchema,
      value: fieldTextSchema.optional(),
      userIds: fieldPeopleSchema.optional(),
    })
    .refine(
      (body) =>
        body.kind === 'TEXT'
          ? body.value !== undefined && body.userIds === undefined
          : body.userIds !== undefined && body.value === undefined,
      { message: 'Um Field TEXT leva value; um PEOPLE, userIds.' },
    ),
) {}

export class EditFieldDto extends createZodDto(
  z
    .strictObject({
      name: fieldNameSchema.optional(),
      value: fieldTextSchema.optional(),
      userIds: fieldPeopleSchema.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Envie ao menos um campo.' })
    .refine((body) => body.value === undefined || body.userIds === undefined, {
      message: 'Um Field nunca mistura tipos: value ou userIds.',
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
