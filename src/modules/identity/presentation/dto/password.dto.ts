import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Strength is the domain's rule (PasswordPolicy → WEAK_PASSWORD); the DTO only
// bounds the input.
const password = z.string().min(1).max(1024)

export class ActivateUserDto extends createZodDto(
  z.object({ token: z.string().min(1).max(200), password }),
) {}

export class ChangePasswordDto extends createZodDto(
  z.object({ currentPassword: password, newPassword: password }),
) {}
