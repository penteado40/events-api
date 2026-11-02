import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { PhoneSchema, UserJsonSchema } from './user.dto.js'

export class CreateUserDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(100).meta({ example: 'Maria Silva' }),
    email: z.string().trim().pipe(z.email()).meta({ example: 'maria@local.test' }),
    phone: PhoneSchema,
  }),
) {}

const ActivationLinkJsonSchema = z.object({
  url: z.url().meta({
    description:
      'O Activation link. Quem o gerou repassa à pessoa, que entra pela primeira vez com este email.',
  }),
  expiresAt: z.iso.datetime(),
})

export type ActivationLinkJson = z.infer<typeof ActivationLinkJsonSchema>

export class CreateUserResponseDto extends createZodDto(
  z.object({ data: z.object({ user: UserJsonSchema, activationLink: ActivationLinkJsonSchema }) }),
) {}

export class ActivationLinkResponseDto extends createZodDto(
  z.object({ data: ActivationLinkJsonSchema }),
) {}
