import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { EVENT_ROLES } from '../../domain/event-member.js'

const role = z.enum(EVENT_ROLES).meta({ example: 'MANAGER' })

export class AddEventMemberDto extends createZodDto(
  z.object({
    email: z.string().trim().pipe(z.email()).meta({ example: 'maria@local.test' }),
    name: z.string().trim().min(1).max(100).meta({
      description: 'Usado só se o email ainda não tem User; um User existente não é alterado.',
      example: 'Maria Silva',
    }),
    role: role.meta({ description: 'Obrigatório: OWNER, MANAGER ou VIEWER.' }),
  }),
) {}

export class ChangeEventMemberRoleDto extends createZodDto(z.object({ role })) {}

export class TransferPrimaryOwnerDto extends createZodDto(
  z.object({
    userId: z.number().int().positive().meta({
      description: 'Um Owner do Event, que passa a ser o Primary owner.',
      example: 2,
    }),
  }),
) {}

export const EventMemberJsonSchema = z.object({
  userId: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(EVENT_ROLES),
  isPrimaryOwner: z.boolean(),
  pending: z.boolean().meta({ description: 'Pending user: ainda não definiu a senha.' }),
})

export type EventMemberJson = z.infer<typeof EventMemberJsonSchema>

export const ActivationLinkJsonSchema = z.object({
  activationToken: z.string().meta({
    description:
      'Entregue à pessoa, que define a senha em `POST /auth/activate`. Aparece só nesta resposta.',
  }),
  expiresAt: z.iso.datetime(),
})

export type ActivationLinkJson = z.infer<typeof ActivationLinkJsonSchema>

export class EventMemberResponseDto extends createZodDto(
  z.object({ data: EventMemberJsonSchema }),
) {}

export class EventMemberListResponseDto extends createZodDto(
  z.object({ data: z.array(EventMemberJsonSchema) }),
) {}

export class AddEventMemberResponseDto extends createZodDto(
  z.object({
    data: EventMemberJsonSchema.extend({
      activation: ActivationLinkJsonSchema.nullable().meta({
        description: 'Só quando o email não tinha User e um Pending user acabou de ser criado.',
      }),
    }),
  }),
) {}

export class MemberActivationLinkResponseDto extends createZodDto(
  z.object({ data: ActivationLinkJsonSchema }),
) {}
