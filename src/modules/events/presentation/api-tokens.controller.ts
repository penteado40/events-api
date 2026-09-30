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
import { CreateApiTokenUseCase } from '../application/use-cases/create-api-token.use-case.js'
import { DeleteApiTokenUseCase } from '../application/use-cases/delete-api-token.use-case.js'
import { GetApiTokenUseCase } from '../application/use-cases/get-api-token.use-case.js'
import { ListApiTokensUseCase } from '../application/use-cases/list-api-tokens.use-case.js'
import { UpdateApiTokenUseCase } from '../application/use-cases/update-api-token.use-case.js'
import { ApiTokenPresenter } from './api-token.presenter.js'
import {
  ApiTokenListResponseDto,
  ApiTokenResponseDto,
  CreateApiTokenDto,
  CreatedApiTokenResponseDto,
  UpdateApiTokenDto,
} from './dto/api-token.dto.js'

/** What `loadEventFor` refuses: a non-member, or a missing Event for the Super admin. */
const EVENT_ACCESS_ERRORS = ['FORBIDDEN', 'NOT_FOUND'] as const

@ApiTags('api tokens')
@Controller('events/:id/api-tokens')
export class ApiTokensController {
  constructor(
    private readonly createApiTokenUseCase: CreateApiTokenUseCase,
    private readonly listApiTokensUseCase: ListApiTokensUseCase,
    private readonly getApiTokenUseCase: GetApiTokenUseCase,
    private readonly updateApiTokenUseCase: UpdateApiTokenUseCase,
    private readonly deleteApiTokenUseCase: DeleteApiTokenUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um API token',
    description:
      'Owners e o Super admin. A resposta traz o valor do token uma única vez; só o hash fica guardado.',
  })
  @ApiCreatedResponse({ type: CreatedApiTokenResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'EVENT_ARCHIVED')
  async create(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Body() body: CreateApiTokenDto,
  ): Promise<CreatedApiTokenResponseDto> {
    const { apiToken, value } = await this.createApiTokenUseCase.execute({
      actor,
      eventId,
      ...body,
    })
    return { data: { ...ApiTokenPresenter.toJson(apiToken), value } }
  }

  @Get()
  @ApiOperation({ summary: 'Listar os API tokens', description: 'Owners e o Super admin.' })
  @ApiOkResponse({ type: ApiTokenListResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS)
  async list(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<ApiTokenListResponseDto> {
    const apiTokens = await this.listApiTokensUseCase.execute({ actor, eventId })
    return { data: apiTokens.map(ApiTokenPresenter.toJson) }
  }

  @Get(':tokenId')
  @ApiOperation({ summary: 'Ver um API token', description: 'Owners e o Super admin.' })
  @ApiOkResponse({ type: ApiTokenResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'API_TOKEN_NOT_FOUND')
  async get(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Param('tokenId', ParseIntPipe) apiTokenId: number,
  ): Promise<ApiTokenResponseDto> {
    const apiToken = await this.getApiTokenUseCase.execute({ actor, eventId, apiTokenId })
    return { data: ApiTokenPresenter.toJson(apiToken) }
  }

  @Patch(':tokenId')
  @ApiOperation({
    summary: 'Editar um API token',
    description:
      'Owners e o Super admin renomeiam, mudam os Scopes, desativam e reativam; o valor não muda. Num Archived event, o Owner só desativa.',
  })
  @ApiOkResponse({ type: ApiTokenResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'EVENT_ARCHIVED', 'API_TOKEN_NOT_FOUND')
  async update(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Param('tokenId', ParseIntPipe) apiTokenId: number,
    @Body() body: UpdateApiTokenDto,
  ): Promise<ApiTokenResponseDto> {
    const apiToken = await this.updateApiTokenUseCase.execute({
      actor,
      eventId,
      apiTokenId,
      changes: body,
    })
    return { data: ApiTokenPresenter.toJson(apiToken) }
  }

  @Delete(':tokenId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Apagar um API token',
    description: 'Owners e o Super admin, inclusive num Archived event.',
  })
  @ApiNoContentResponse()
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'API_TOKEN_NOT_FOUND')
  async delete(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Param('tokenId', ParseIntPipe) apiTokenId: number,
  ): Promise<void> {
    await this.deleteApiTokenUseCase.execute({ actor, eventId, apiTokenId })
  }
}
