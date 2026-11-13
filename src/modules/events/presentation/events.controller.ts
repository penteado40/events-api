import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import { ParseIdPipe } from '../../../shared/presentation/parse-id.pipe.js'
import type { User } from '../../identity/index.js'
import { CreateEventUseCase } from '../application/use-cases/create-event.use-case.js'
import { EditEventUseCase } from '../application/use-cases/edit-event.use-case.js'
import { GetEventUseCase } from '../application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from '../application/use-cases/list-events.use-case.js'
import {
  CreateEventDto,
  EditEventDto,
  EventListResponseDto,
  EventResponseDto,
} from './dto/event.dto.js'
import { EventPresenter } from './event.presenter.js'

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(
    private readonly createEventUseCase: CreateEventUseCase,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly getEventUseCase: GetEventUseCase,
    private readonly editEventUseCase: EditEventUseCase,
  ) {}

  @Post('groups/:id/events')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Event',
    description:
      'O Super admin ou um Owner do Group. O Event nasce em Draft, e todo Group member já vê onde e quando. Data final antes da inicial: 400 EVENT_PERIOD_INVALID. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiCreatedResponse({ type: EventResponseDto })
  @ApiErrors('EVENT_PERIOD_INVALID', 'FORBIDDEN', 'NOT_FOUND')
  async create(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) groupId: number,
    @Body() body: CreateEventDto,
  ): Promise<EventResponseDto> {
    const view = await this.createEventUseCase.execute({ actor, groupId, ...body })
    return { data: EventPresenter.toJson(view) }
  }

  @Get('groups/:id/events')
  @ApiOperation({
    summary: 'Listar os Events do Group',
    description:
      'O Super admin ou qualquer Group member do Group (Owner ou Viewer), Drafts incluídos. Por data inicial, cada um com o estado e se é um Finished event. Quem não é Group member do Group recebe 404.',
  })
  @ApiOkResponse({ type: EventListResponseDto })
  @ApiErrors('NOT_FOUND')
  async list(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) groupId: number,
  ): Promise<EventListResponseDto> {
    const views = await this.listEventsUseCase.execute({ actor, groupId })
    return { data: views.map(EventPresenter.toJson) }
  }

  @Get('events/:id')
  @ApiOperation({
    summary: 'Ver um Event',
    description:
      'O Super admin ou qualquer Group member do Group do Event. Quem não é Group member do Group recebe 404.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors('NOT_FOUND')
  async get(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<EventResponseDto> {
    const view = await this.getEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toJson(view) }
  }

  @Patch('events/:id')
  @ApiOperation({
    summary: 'Editar um Event',
    description:
      'O Super admin ou um Owner do Group do Event edita nome, onde e quando, também de um Finished event. O que não é enviado não muda; o período vai inteiro. Data final antes da inicial: 400 EVENT_PERIOD_INVALID. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors('EVENT_PERIOD_INVALID', 'FORBIDDEN', 'NOT_FOUND')
  async edit(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Body() body: EditEventDto,
  ): Promise<EventResponseDto> {
    const view = await this.editEventUseCase.execute({ actor, eventId, ...body })
    return { data: EventPresenter.toJson(view) }
  }
}
