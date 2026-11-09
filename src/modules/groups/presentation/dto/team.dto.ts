import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { TEAM_NAME_MAX_LENGTH } from '../../domain/team-name.vo.js'

/** The domain checks it again (TeamName); here it is for the 400 and the docs. */
const TeamNameBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(TEAM_NAME_MAX_LENGTH).meta({ example: 'Banda' }),
})

/** Public shape of a Team. */
const TeamJsonSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  groupId: z.number().int().meta({ example: 1 }),
  name: z.string().meta({ example: 'Banda' }),
  createdAt: z.iso.datetime(),
})

export type TeamJson = z.infer<typeof TeamJsonSchema>

export class CreateTeamDto extends createZodDto(TeamNameBodySchema) {}

export class RenameTeamDto extends createZodDto(TeamNameBodySchema) {}

export class TeamResponseDto extends createZodDto(z.object({ data: TeamJsonSchema })) {}

export class TeamListResponseDto extends createZodDto(
  z.object({ data: z.array(TeamJsonSchema) }),
) {}
