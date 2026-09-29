import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { PasswordPolicy } from '../../domain/password-policy.js'

// Strength is the domain's rule (PasswordPolicy → WEAK_PASSWORD); the DTO only
// bounds the input.
const password = z.string().min(1).max(1024)
const strongPassword = password.meta({
  description: `Pelo menos ${PasswordPolicy.MIN_LENGTH} caracteres e no máximo ${PasswordPolicy.MAX_BYTES} bytes.`,
})

export class ActivateUserDto extends createZodDto(
  z.object({
    token: z.string().min(1).max(200).meta({
      description: 'O `activationToken` devolvido na criação do User ou na reemissão do link.',
      // Only exists at runtime, so the example is a placeholder to replace.
      example: 'cole-aqui-o-activationToken',
    }),
    password: strongPassword.meta({ example: 'senha-local-123' }),
  }),
) {}

// The examples "change" the password of the Super admin of the local seed to
// itself, so running them keeps the login example working.
export class ChangePasswordDto extends createZodDto(
  z.object({
    currentPassword: password.meta({ example: 'admin-local-123' }),
    newPassword: strongPassword.meta({ example: 'admin-local-123' }),
  }),
) {}
