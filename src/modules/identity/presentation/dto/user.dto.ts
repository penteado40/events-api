import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { ROLES } from '../../domain/user.entity.js'

/** Public shape of a User: never the password hash. */
export const UserJsonSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.email(),
  role: z.enum(ROLES),
  createdAt: z.iso.datetime(),
})

export type UserJson = z.infer<typeof UserJsonSchema>

export class MeResponseDto extends createZodDto(z.object({ data: UserJsonSchema })) {}
