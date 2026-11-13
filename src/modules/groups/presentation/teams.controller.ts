import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import type { User } from '../../identity/index.js'
import { CreateTeamUseCase } from '../application/use-cases/create-team.use-case.js'
import { DeleteTeamUseCase } from '../application/use-cases/delete-team.use-case.js'
import { ListTeamsUseCase } from '../application/use-cases/list-teams.use-case.js'
import { RenameTeamUseCase } from '../application/use-cases/rename-team.use-case.js'
import {
  CreateTeamDto,
  RenameTeamDto,
  TeamListResponseDto,
  TeamResponseDto,
} from './dto/team.dto.js'
import { TeamPresenter } from './team.presenter.js'

@ApiTags('teams')
@Controller('groups/:id/teams')
export class TeamsController {
  constructor(
    private readonly createTeamUseCase: CreateTeamUseCase,
    private readonly renameTeamUseCase: RenameTeamUseCase,
    private readonly listTeamsUseCase: ListTeamsUseCase,
    private readonly deleteTeamUseCase: DeleteTeamUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Team',
    description:
      'O Super admin ou um Owner do Group. O nome é único no Group (409 TEAM_NAME_TAKEN). Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiCreatedResponse({ type: TeamResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'TEAM_NAME_TAKEN')
  async create(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Body() body: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    const team = await this.createTeamUseCase.execute({ actor, groupId, name: body.name })
    return { data: TeamPresenter.toJson(team) }
  }

  @Get()
  @ApiOperation({
    summary: 'Listar os Teams do Group',
    description:
      'O Super admin ou qualquer Group member do Group (Owner ou Viewer). Por nome. Quem não é Group member do Group recebe 404.',
  })
  @ApiOkResponse({ type: TeamListResponseDto })
  @ApiErrors('NOT_FOUND')
  async list(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
  ): Promise<TeamListResponseDto> {
    const teams = await this.listTeamsUseCase.execute({ actor, groupId })
    return { data: teams.map(TeamPresenter.toJson) }
  }

  @Patch(':teamId')
  @ApiOperation({
    summary: 'Renomear um Team',
    description:
      'O Super admin ou um Owner do Group. O nome é único no Group (409 TEAM_NAME_TAKEN). Se o Team não é do Group, 404. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiOkResponse({ type: TeamResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'TEAM_NAME_TAKEN')
  async rename(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() body: RenameTeamDto,
  ): Promise<TeamResponseDto> {
    const team = await this.renameTeamUseCase.execute({ actor, groupId, teamId, name: body.name })
    return { data: TeamPresenter.toJson(team) }
  }

  @Delete(':teamId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Apagar um Team',
    description:
      'O Super admin ou um Owner do Group. Se o Team não é do Group, 404. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiNoContentResponse()
  @ApiErrors('FORBIDDEN', 'NOT_FOUND')
  async delete(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<void> {
    await this.deleteTeamUseCase.execute({ actor, groupId, teamId })
  }
}
