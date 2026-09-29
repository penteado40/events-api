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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOAuth2,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import type { User } from '../../identity/index.js'
import { ArchiveEventUseCase } from '../application/use-cases/archive-event.use-case.js'
import { CreateEventUseCase } from '../application/use-cases/create-event.use-case.js'
import { GetEventUseCase } from '../application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from '../application/use-cases/list-events.use-case.js'
import { UnarchiveEventUseCase } from '../application/use-cases/unarchive-event.use-case.js'
import { UpdateEventUseCase } from '../application/use-cases/update-event.use-case.js'
import {
  CreateEventDto,
  EventListResponseDto,
  EventResponseDto,
  ListEventsQueryDto,
  UpdateEventDto,
} from './dto/event.dto.js'
import { EventPresenter } from './event.presenter.js'

@ApiTags('events')
@ApiBearerAuth()
@ApiOAuth2([], 'oauth2')
@Controller('events')
export class EventsController {
  constructor(
    private readonly createEventUseCase: CreateEventUseCase,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly getEventUseCase: GetEventUseCase,
    private readonly updateEventUseCase: UpdateEventUseCase,
    private readonly archiveEventUseCase: ArchiveEventUseCase,
    private readonly unarchiveEventUseCase: UnarchiveEventUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: EventResponseDto })
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
  @ApiOkResponse({ type: EventListResponseDto })
  async list(
    @CurrentUser() actor: User,
    @Query() query: ListEventsQueryDto,
  ): Promise<EventListResponseDto> {
    const result = await this.listEventsUseCase.execute({ actor, status: query.status })
    return { data: result.map(EventPresenter.toJson) }
  }

  @Get(':id')
  @ApiOkResponse({ type: EventResponseDto })
  async get(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<EventResponseDto> {
    return { data: EventPresenter.toJson(await this.getEventUseCase.execute({ actor, eventId })) }
  }

  @Patch(':id')
  @ApiOkResponse({ type: EventResponseDto })
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
  @ApiOkResponse({ type: EventResponseDto })
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
  @ApiOkResponse({ type: EventResponseDto })
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
