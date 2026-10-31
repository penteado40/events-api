import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
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
