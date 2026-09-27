import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { UserJsonSchema } from './user.dto.js'

export class LoginDto extends createZodDto(
  z.object({
    email: z.string().trim().pipe(z.email()),
    password: z.string().min(1).max(200),
  }),
) {}

export class LoginResponseDto extends createZodDto(
  z.object({
    data: z.object({ token: z.string(), user: UserJsonSchema }),
  }),
) {}
