import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { SCOPES } from '../../domain/scope.js'

const name = z.string().trim().min(1).max(100).meta({ example: 'Site do evento' })
const scopes = z
  .array(z.enum(SCOPES))
  .min(1)
  .meta({
    description:
      'Sem repetição: `event:read`, `rsvp:create`, `registry:read`, `contribution:create`.',
    example: ['event:read', 'rsvp:create', 'registry:read', 'contribution:create'],
  })

export class CreateApiTokenDto extends createZodDto(z.object({ name, scopes })) {}

/** The value never changes here; unknown fields are refused. */
export class UpdateApiTokenDto extends createZodDto(
  z.strictObject({
    name: name.optional(),
    scopes: scopes.optional(),
    isActive: z.boolean().optional().meta({
      description: 'Num Archived event, o Owner só pode enviar `false` (revogar).',
      example: false,
    }),
  }),
) {}

export const ApiTokenJsonSchema = z.object({
  id: z.number().int(),
  eventId: z.number().int(),
  name: z.string(),
  scopes: z.array(z.enum(SCOPES)),
  isActive: z.boolean(),
  lastUsedAt: z.iso.datetime().nullable().meta({
    description: 'Último uso pelo Site, com precisão de uma hora; null se nunca usado.',
  }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type ApiTokenJson = z.infer<typeof ApiTokenJsonSchema>

export class ApiTokenResponseDto extends createZodDto(z.object({ data: ApiTokenJsonSchema })) {}

export class ApiTokenListResponseDto extends createZodDto(
  z.object({ data: z.array(ApiTokenJsonSchema) }),
) {}

export class CreatedApiTokenResponseDto extends createZodDto(
  z.object({
    data: ApiTokenJsonSchema.extend({
      value: z.string().meta({
        description: 'O valor do token, mostrado só agora. Vai no header `X-Api-Key` do Site.',
      }),
    }),
  }),
) {}
