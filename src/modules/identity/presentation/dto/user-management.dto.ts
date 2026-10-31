import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { UserJsonSchema } from './user.dto.js'

export class CreateUserDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(100).meta({ example: 'Maria Silva' }),
    email: z.string().trim().pipe(z.email()).meta({ example: 'maria@local.test' }),
  }),
) {}

const ActivationLinkJsonSchema = z.object({
  activationToken: z.string().meta({
    description:
      'Aparece só nesta resposta. Ainda não ativa nada: vira convite do Clerk na PROJ-170.',
  }),
  expiresAt: z.iso.datetime(),
})

export class CreateUserResponseDto extends createZodDto(
  z.object({ data: ActivationLinkJsonSchema.extend({ user: UserJsonSchema }) }),
) {}

export class ActivationLinkResponseDto extends createZodDto(
  z.object({ data: ActivationLinkJsonSchema }),
) {}
