import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import { ParseIdPipe } from '../../../shared/presentation/parse-id.pipe.js'
import type { User } from '../../identity/index.js'
import { AddParticipantUseCase } from '../application/use-cases/add-participant.use-case.js'
import { CancelEventUseCase } from '../application/use-cases/cancel-event.use-case.js'
import { CreateEventUseCase } from '../application/use-cases/create-event.use-case.js'
import { EditEventUseCase } from '../application/use-cases/edit-event.use-case.js'
import { GetEventUseCase } from '../application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from '../application/use-cases/list-events.use-case.js'
import { ListParticipantsUseCase } from '../application/use-cases/list-participants.use-case.js'
import { PublishEventUseCase } from '../application/use-cases/publish-event.use-case.js'
import { RemoveParticipantUseCase } from '../application/use-cases/remove-participant.use-case.js'
import { UncancelEventUseCase } from '../application/use-cases/uncancel-event.use-case.js'
import {
  CreateEventDto,
  EditEventDto,
  EventDetailResponseDto,
  EventListResponseDto,
  EventResponseDto,
  ParticipantListResponseDto,
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
    private readonly publishEventUseCase: PublishEventUseCase,
    private readonly cancelEventUseCase: CancelEventUseCase,
    private readonly uncancelEventUseCase: UncancelEventUseCase,
    private readonly listParticipantsUseCase: ListParticipantsUseCase,
    private readonly addParticipantUseCase: AddParticipantUseCase,
    private readonly removeParticipantUseCase: RemoveParticipantUseCase,
  ) {}

  @Post('groups/:id/events')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Event',
    description:
      'O Super admin ou um Owner do Group. O Event nasce em Draft, e todo Group member já vê onde e quando. A lista de Participants nasce como cópia de todos os Group members do momento (Owners e Viewers); quem entra no Group depois não vira Participant dele. Data final antes da inicial: 400 EVENT_PERIOD_INVALID. Quem não é Group member do Group recebe 404; um Viewer, 403.',
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
      'O Super admin ou qualquer Group member do Group do Event, com a Membership de quem pede no Event: se é Participant dele (null para o Super admin). Quem não é Group member do Group recebe 404.',
  })
  @ApiOkResponse({ type: EventDetailResponseDto })
  @ApiErrors('NOT_FOUND')
  async get(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<EventDetailResponseDto> {
    const view = await this.getEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toDetailJson(view) }
  }

  @Get('events/:id/participants')
  @ApiOperation({
    summary: 'Listar os Participants de um Event',
    description:
      'O Super admin ou qualquer Group member do Group do Event, vá ou não: nome, telefone (E.164, para abrir o WhatsApp) e papel no Group de cada Participant, na ordem da lista. Quem não é Group member do Group recebe 404.',
  })
  @ApiOkResponse({ type: ParticipantListResponseDto })
  @ApiErrors('NOT_FOUND')
  async listParticipants(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<ParticipantListResponseDto> {
    const participants = await this.listParticipantsUseCase.execute({ actor, eventId })
    return { data: participants.map(EventPresenter.toParticipantJson) }
  }

  @Put('events/:id/participants/:userId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Adicionar um Participant ao Event',
    description:
      'O Super admin ou um Owner do Group do Event adiciona um Group member do Group (Owner ou Viewer) à lista de Participants. Se o User do caminho não é Group member do Group, 404; se já é Participant, nada muda. A entrada vira uma Change no Change log que só a produção vê, gravada junto. Um Event Cancelled está congelado: 409 EVENT_CANCELLED. Quanto a quem chama: quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiNoContentResponse()
  @ApiErrors('EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async addParticipant(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('userId', ParseIdPipe) userId: number,
  ): Promise<void> {
    await this.addParticipantUseCase.execute({ actor, eventId, userId })
  }

  @Delete('events/:id/participants/:userId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Tirar um Participant do Event',
    description:
      'O Super admin ou um Owner do Group do Event tira alguém da lista de Participants, um Owner ou quem já saiu do Group inclusive. Se o User do caminho não é Participant, 404. A saída vira uma Change no Change log que só a produção vê, gravada junto; quem sai deixa de ser alcançado pelos Event items. Um Event Cancelled está congelado: 409 EVENT_CANCELLED. Quanto a quem chama: quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiNoContentResponse()
  @ApiErrors('EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async removeParticipant(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('userId', ParseIdPipe) userId: number,
  ): Promise<void> {
    await this.removeParticipantUseCase.execute({ actor, eventId, userId })
  }

  @Patch('events/:id')
  @ApiOperation({
    summary: 'Editar um Event',
    description:
      'O Super admin ou um Owner do Group do Event edita nome, onde e quando, também de um Finished event. O que não é enviado não muda; o período vai inteiro. Cada atributo alterado vira uma Change no Change log, gravada junto com a edição; salvar sem alterar nada não grava nada. Data final antes da inicial: 400 EVENT_PERIOD_INVALID. Um Event Cancelled está congelado: 409 EVENT_CANCELLED. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors('EVENT_PERIOD_INVALID', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async edit(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Body() body: EditEventDto,
  ): Promise<EventResponseDto> {
    const view = await this.editEventUseCase.execute({ actor, eventId, ...body })
    return { data: EventPresenter.toJson(view) }
  }

  @Post('events/:id/publish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Publicar um Event',
    description:
      'O Super admin ou um Owner do Group do Event publica um Event em Draft: os Event items publicados passam a aparecer para quem eles alcançam. A mudança de estado vira uma Change no Change log, gravada junto com a publicação. Um Event já publicado: 409 EVENT_NOT_DRAFT; um Cancelled, congelado: 409 EVENT_CANCELLED. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors('EVENT_NOT_DRAFT', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async publish(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<EventResponseDto> {
    const view = await this.publishEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toJson(view) }
  }

  @Post('events/:id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancelar um Event',
    description:
      'O Super admin ou um Owner do Group do Event cancela um Event em Draft ou publicado: ele continua visível, com o estado CANCELLED, e fica congelado (nenhuma escrita nele nem nos Event items dele) até ser descancelado. A mudança de estado vira uma Change no Change log, gravada junto com o cancelamento. Um Event já Cancelled: 409 EVENT_CANCELLED. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors('EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async cancel(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<EventResponseDto> {
    const view = await this.cancelEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toJson(view) }
  }

  @Post('events/:id/uncancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Descancelar um Event',
    description:
      'O Super admin ou um Owner do Group do Event descancela um Event Cancelled: ele volta ao estado de antes do cancelamento (DRAFT ou PUBLISHED) e aceita escritas de novo. A mudança de estado vira uma Change no Change log, gravada junto com o descancelamento. Um Event que não está Cancelled: 409 EVENT_NOT_CANCELLED. Quem não é Group member do Group recebe 404; um Viewer, 403.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiErrors('EVENT_NOT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async uncancel(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<EventResponseDto> {
    const view = await this.uncancelEventUseCase.execute({ actor, eventId })
    return { data: EventPresenter.toJson(view) }
  }
}
