import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const GroupNameSchema = z.string().trim().min(1).max(100).meta({ example: 'Vocal Livre' })

/** Public shape of a Group. */
export const GroupJsonSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  name: z.string().meta({ example: 'Vocal Livre' }),
  createdAt: z.iso.datetime(),
})

export type GroupJson = z.infer<typeof GroupJsonSchema>

export class CreateGroupDto extends createZodDto(z.strictObject({ name: GroupNameSchema })) {}

export class RenameGroupDto extends createZodDto(z.strictObject({ name: GroupNameSchema })) {}

export class GroupResponseDto extends createZodDto(z.object({ data: GroupJsonSchema })) {}

export class GroupListResponseDto extends createZodDto(
  z.object({ data: z.array(GroupJsonSchema) }),
) {}
