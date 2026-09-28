import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { UserJsonSchema } from './user.dto.js'

export class CreateUserDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().pipe(z.email()),
  }),
) {}

const ActivationLinkJsonSchema = z.object({
  /** Deliver it to the person; it is shown only once. */
  activationToken: z.string(),
  expiresAt: z.iso.datetime(),
})

export class CreateUserResponseDto extends createZodDto(
  z.object({ data: ActivationLinkJsonSchema.extend({ user: UserJsonSchema }) }),
) {}

export class ActivationLinkResponseDto extends createZodDto(
  z.object({ data: ActivationLinkJsonSchema }),
) {}
