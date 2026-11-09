import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { GROUP_ROLES } from '../../domain/group-member.js'
import { GROUP_NAME_MAX_LENGTH } from '../../domain/group-name.vo.js'

/** The domain checks it again (GroupName); here it is for the 400 and the docs. */
const GroupNameBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(GROUP_NAME_MAX_LENGTH).meta({ example: 'Vocal Livre' }),
})

/** Public shape of a Group. */
export const GroupJsonSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  name: z.string().meta({ example: 'Vocal Livre' }),
  createdAt: z.iso.datetime(),
})

export type GroupJson = z.infer<typeof GroupJsonSchema>

export class CreateGroupDto extends createZodDto(GroupNameBodySchema) {}

export class RenameGroupDto extends createZodDto(GroupNameBodySchema) {}

export class GroupResponseDto extends createZodDto(z.object({ data: GroupJsonSchema })) {}

export class GroupListResponseDto extends createZodDto(
  z.object({ data: z.array(GroupJsonSchema) }),
) {}

/** The domain checks email and phone again (identity); here they are for the 400 and the docs. */
const AddMemberBodySchema = z.strictObject({
  email: z.string().trim().pipe(z.email()).meta({ example: 'maria@local.test' }),
  name: z.string().trim().min(1).max(100).meta({
    description: 'Usado só se o email ainda não tem User.',
    example: 'Maria Silva',
  }),
  phone: z.string().trim().min(1).max(30).meta({
    description: 'Com DDI. Usado só se o email ainda não tem User.',
    example: '+55 11 98765-4321',
  }),
})

const GroupMemberListItemJsonSchema = z.object({
  userId: z.number().int().meta({ example: 2 }),
  name: z.string().meta({ example: 'Maria Silva' }),
  email: z.email().meta({ example: 'maria@local.test' }),
  phone: z
    .string()
    .meta({ description: 'E.164, para abrir o WhatsApp.', example: '+5511987654321' }),
  role: z.enum(GROUP_ROLES).meta({ example: 'OWNER' }),
  isPending: z.boolean().meta({
    description: 'Ainda não entrou pela primeira vez pelo Activation link.',
    example: false,
  }),
})

export type GroupMemberListItemJson = z.infer<typeof GroupMemberListItemJsonSchema>

export class GroupMemberListResponseDto extends createZodDto(
  z.object({ data: z.array(GroupMemberListItemJsonSchema) }),
) {}

export class AddOwnerDto extends createZodDto(AddMemberBodySchema) {}

export class AddViewerDto extends createZodDto(AddMemberBodySchema) {}

const GroupMemberJsonSchema = z.object({
  groupId: z.number().int().meta({ example: 1 }),
  role: z.enum(GROUP_ROLES).meta({ example: 'OWNER' }),
  user: z.object({
    id: z.number().int().meta({ example: 2 }),
    name: z.string().meta({ example: 'Maria Silva' }),
    email: z.email().meta({ example: 'maria@local.test' }),
    isPending: z.boolean().meta({
      description: 'Ainda não entrou pela primeira vez pelo Activation link.',
      example: true,
    }),
  }),
})

export type GroupMemberJson = z.infer<typeof GroupMemberJsonSchema>

/** The role a Group member has now, after it changed. */
const GroupRoleJsonSchema = z.object({
  groupId: z.number().int().meta({ example: 1 }),
  userId: z.number().int().meta({ example: 2 }),
  role: z.enum(GROUP_ROLES).meta({ example: 'VIEWER' }),
})

export type GroupRoleJson = z.infer<typeof GroupRoleJsonSchema>

export class GroupRoleResponseDto extends createZodDto(z.object({ data: GroupRoleJsonSchema })) {}

const ActivationLinkJsonSchema = z.object({
  url: z.url().meta({
    description:
      'O Activation link. Quem o gerou repassa à pessoa, que entra pela primeira vez com este email.',
  }),
  expiresAt: z.iso.datetime(),
})

export type ActivationLinkJson = z.infer<typeof ActivationLinkJsonSchema>

export class AddOwnerResponseDto extends createZodDto(
  z.object({
    data: z.object({
      member: GroupMemberJsonSchema,
      activationLink: ActivationLinkJsonSchema.nullable().meta({
        description: 'Só quando o email não tinha User: o Owner nasce Pending user.',
      }),
    }),
  }),
) {}

export class AddViewerResponseDto extends createZodDto(
  z.object({
    data: z.object({
      member: GroupMemberJsonSchema,
      activationLink: ActivationLinkJsonSchema.nullable().meta({
        description: 'Só quando o email não tinha User: o Viewer nasce Pending user.',
      }),
    }),
  }),
) {}
