import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { UserJsonSchema } from './user.dto.js'

// The examples log in the Super admin of the local seed; never a credential that
// exists outside the local environment.
export class LoginDto extends createZodDto(
  z.object({
    email: z.string().trim().pipe(z.email()).meta({ example: 'admin@local.test' }),
    password: z.string().min(1).max(200).meta({ example: 'Admin-local-123' }),
  }),
) {}

export class LoginResponseDto extends createZodDto(
  z.object({
    data: z.object({
      token: z.string().meta({ description: 'JWT da sessão, válido por 12 horas.' }),
      user: UserJsonSchema,
    }),
  }),
) {}
