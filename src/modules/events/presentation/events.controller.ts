import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AppError } from '../../../shared/domain/app-error.js'
import { AcceptsApiToken, CurrentApiToken } from '../../../shared/presentation/api-token.js'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import type { User } from '../../identity/index.js'
import { ArchiveEventUseCase } from '../application/use-cases/archive-event.use-case.js'
import { CreateEventUseCase } from '../application/use-cases/create-event.use-case.js'
import type { SiteCredential } from '../application/site-credential.js'
import { GetEventUseCase } from '../application/use-cases/get-event.use-case.js'
import { GetPublicEventUseCase } from '../application/use-cases/get-public-event.use-case.js'
import { ListEventsUseCase } from '../application/use-cases/list-events.use-case.js'
import { UnarchiveEventUseCase } from '../application/use-cases/unarchive-event.use-case.js'
import { UpdateEventUseCase } from '../application/use-cases/update-event.use-case.js'
import {
  CreateEventDto,
  EventListResponseDto,
  EventResponseDto,
  ListEventsQueryDto,
  PublicEventResponseDto,
  UpdateEventDto,
} from './dto/event.dto.js'
import { EventPresenter } from './event.presenter.js'
import { EVENT_ACCESS_ERRORS } from './event-access-errors.js'

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly createEventUseCase: CreateEventUseCase,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly getEventUseCase: GetEventUseCase,
    private readonly updateEventUseCase: UpdateEventUseCase,
    private readonly archiveEventUseCase: ArchiveEventUseCase,
    private readonly unarchiveEventUseCase: UnarchiveEventUseCase,
    private readonly getPublicEventUseCase: GetPublicEventUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Event',
    description: 'Só o Super admin, opcionalmente já indicando o Primary owner.',
  })
  @ApiCreatedResponse({ type: EventResponseDto })
  @ApiErrors('FORBIDDEN', 'SLUG_ALREADY_IN_USE', 'PRIMARY_OWNER_INVALID')
  async create(
    @CurrentUser() actor: User,
    @Body() body: CreateEventDto,
  ): Promise<EventResponseDto> {
    const result = await this.createEventUseCase.execute({
      ...body,
      actor,
      startsAt: new Date(body.startsAt),
      endsAt: toDate(body.endsAt),
    })
    return { data: EventPresenter.toJson(result) }
  }

  @Get()
  @ApiOperation({
    summary: 'Listar Events',
    description: 'Os Events de que o User é Event member; o Super admin vê todos.',
  })
  @ApiOkResponse({ type: EventListResponseDto })
  @ApiErrors()
  async list(
    @CurrentUser() actor: User,
    @Query() query: ListEventsQueryDto,
  ): Promise<EventListResponseDto> {
    const result = await this.listEventsUseCase.execute({ actor, status: query.status })
    return { data: result.map(EventPresenter.toJson) }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver um Event' })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS)
  async get(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<EventResponseDto> {
    return { data: EventPresenter.toJson(await this.getEventUseCase.execute({ actor, eventId })) }
  }

  @Get(':id/public')
  @AcceptsApiToken()
  @ApiOperation({
    summary: 'Ler a parte pública de um Event',
    description:
      'O Site, com um API token de Scope `event:read` no header `X-Api-Key`; Event members e o Super admin também, para ver o que o Site vê. Responde mesmo com o Event arquivado.',
  })
  @ApiOkResponse({ type: PublicEventResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'INSUFFICIENT_SCOPE')
  async getPublic(
    @CurrentUser() user: User | undefined,
    @CurrentApiToken() site: SiteCredential | undefined,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<PublicEventResponseDto> {
    // The guard puts one of them on the request.
    const actor = site ?? user
    if (!actor) throw new AppError('UNAUTHENTICATED')
    const event = await this.getPublicEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toPublicJson(event) }
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar um Event',
    description:
      'Owners, Managers e o Super admin; mudar o `siteUrl` é só para Owners e o Super admin. Um Archived event não aceita edição de Event members.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'EVENT_ARCHIVED')
  async update(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Body() body: UpdateEventDto,
  ): Promise<EventResponseDto> {
    const { startsAt, endsAt, ...changes } = body
    const result = await this.updateEventUseCase.execute({
      actor,
      eventId,
      changes: {
        ...changes,
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(endsAt !== undefined && { endsAt: toDate(endsAt) }),
      },
    })
    return { data: EventPresenter.toJson(result) }
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Arquivar um Event', description: 'Owners e o Super admin.' })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS)
  async archive(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<EventResponseDto> {
    return {
      data: EventPresenter.toJson(await this.archiveEventUseCase.execute({ actor, eventId })),
    }
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desarquivar um Event', description: 'Só o Super admin.' })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS)
  async unarchive(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<EventResponseDto> {
    const result = await this.unarchiveEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toJson(result) }
  }
}

function toDate(value: string | null | undefined): Date | null | undefined {
  return value === null || value === undefined ? value : new Date(value)
}
