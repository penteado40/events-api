import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { ROLES } from '../../domain/user.entity.js'

const NameSchema = z.string().trim().min(1).max(100)

/** Any usual typing of a phone with the country code; it is stored in E.164. */
export const PhoneSchema = z.string().trim().min(1).max(30).meta({
  description: 'Com DDI. Aceita espaços, parênteses, pontos e hífens; volta sem eles.',
  example: '+55 11 98765-4321',
})

/** Public shape of a User. */
export const UserJsonSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.email(),
  phone: z.string().meta({ example: '+5511987654321' }),
  role: z.enum(ROLES),
  createdAt: z.iso.datetime(),
})

export type UserJson = z.infer<typeof UserJsonSchema>

export class MeResponseDto extends createZodDto(z.object({ data: UserJsonSchema })) {}

/** The email comes from Clerk: a body with `email`, or with nothing to change, is refused. */
export class UpdateMeDto extends createZodDto(
  z
    .strictObject({
      name: NameSchema.optional().meta({ example: 'Maria Souza' }),
      phone: PhoneSchema.optional(),
    })
    .refine((body) => body.name !== undefined || body.phone !== undefined, {
      message: 'Informe name ou phone.',
    }),
) {}
