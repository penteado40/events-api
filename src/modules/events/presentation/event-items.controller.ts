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
import { CancelEventItemUseCase } from '../application/use-cases/cancel-event-item.use-case.js'
import { CreateEventItemUseCase } from '../application/use-cases/create-event-item.use-case.js'
import { DeleteEventItemUseCase } from '../application/use-cases/delete-event-item.use-case.js'
import { EditEventItemUseCase } from '../application/use-cases/edit-event-item.use-case.js'
import { GetScheduleUseCase } from '../application/use-cases/get-schedule.use-case.js'
import { PublishEventItemUseCase } from '../application/use-cases/publish-event-item.use-case.js'
import { ReorderEventItemsUseCase } from '../application/use-cases/reorder-event-items.use-case.js'
import { UncancelEventItemUseCase } from '../application/use-cases/uncancel-event-item.use-case.js'
import {
  CreateEventItemDto,
  EditEventItemDto,
  EventItemResponseDto,
  ReorderEventItemsDto,
  ScheduleResponseDto,
} from './dto/event-item.dto.js'
import { EventItemPresenter } from './event-item.presenter.js'

@ApiTags('event items')
@Controller('events/:id')
export class EventItemsController {
  constructor(
    private readonly createEventItemUseCase: CreateEventItemUseCase,
    private readonly editEventItemUseCase: EditEventItemUseCase,
    private readonly deleteEventItemUseCase: DeleteEventItemUseCase,
    private readonly publishEventItemUseCase: PublishEventItemUseCase,
    private readonly cancelEventItemUseCase: CancelEventItemUseCase,
    private readonly uncancelEventItemUseCase: UncancelEventItemUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly reorderEventItemsUseCase: ReorderEventItemsUseCase,
  ) {}

  @Post('items')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event. Num Event em Draft, o item nasce publicado; num Event publicado, nasce em Draft, e só os Owners o veem até ser publicado. A criação vira uma Change no Change log. Data e hora de início são locais e opcionais, nunca convertidas; hora sem data: 400 EVENT_ITEM_TIME_WITHOUT_DATE. O lugar é opcional e, sem fuso próprio, vale o do Event. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiCreatedResponse({ type: EventItemResponseDto })
  @ApiErrors('EVENT_ITEM_TIME_WITHOUT_DATE', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async create(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Body() body: CreateEventItemDto,
  ): Promise<EventItemResponseDto> {
    const view = await this.createEventItemUseCase.execute({ actor, eventId, ...body })
    return { data: EventItemPresenter.toJson(view) }
  }

  @Put('items/order')
  @ApiOperation({
    summary: 'Reordenar os Event items onde a hora não decide',
    description:
      'O Super admin ou um Owner do Group do Event dá a nova ordem da produção de Event items empatados, onde a hora não decide: todos sem data (a General info), todos do mesmo dia sem hora ou todos do mesmo dia e hora. A ordem nunca passa por cima da hora. Vêm todos os itens empatados, como estão agora: itens que a hora já ordena, 400 EVENT_ITEM_ORDER_MIXED; faltando algum, 409 EVENT_ITEM_ORDER_INCOMPLETE (também quando outra escrita mudou o empate antes). Responde a programação inteira, na nova ordem. Item de outro Event: 404. Reordenar é uma Change do Event que só a produção vê; a mesma ordem não grava nada. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiOkResponse({ type: ScheduleResponseDto })
  @ApiErrors(
    'EVENT_ITEM_ORDER_MIXED',
    'EVENT_ITEM_ORDER_INCOMPLETE',
    'EVENT_CANCELLED',
    'FORBIDDEN',
    'NOT_FOUND',
  )
  async reorder(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Body() body: ReorderEventItemsDto,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.reorderEventItemsUseCase.execute({
      actor,
      eventId,
      itemIds: body.itemIds,
    })
    return { data: EventItemPresenter.scheduleToJson(schedule) }
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Editar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event. O que não é enviado não muda; null apaga a data, a hora ou o lugar, e o lugar e o Audience vão inteiros. O que sobra não pode ter hora sem data: 400 EVENT_ITEM_TIME_WITHOUT_DATE. O Audience é "Todos" ou pessoas escolhidas só entre os Participants do Event: quem não é Participant, 409 NOT_A_PARTICIPANT. Mudar o Audience é uma Change que só a produção vê. Um item Cancelled está congelado até ser descancelado: 409 EVENT_ITEM_CANCELLED. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiOkResponse({ type: EventItemResponseDto })
  @ApiErrors(
    'EVENT_ITEM_TIME_WITHOUT_DATE',
    'NOT_A_PARTICIPANT',
    'EVENT_ITEM_CANCELLED',
    'EVENT_CANCELLED',
    'FORBIDDEN',
    'NOT_FOUND',
  )
  async edit(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
    @Body() body: EditEventItemDto,
  ): Promise<EventItemResponseDto> {
    const view = await this.editEventItemUseCase.execute({ actor, eventId, itemId, ...body })
    return { data: EventItemPresenter.toJson(view) }
  }

  @Post('items/:itemId/publish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Publicar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event publica um Event item em Draft: ele passa a aparecer para quem ele alcança. A mudança de estado vira uma Change no Change log, gravada junto com a publicação. Um item que não está em Draft (publicado ou Cancelled): 409 EVENT_ITEM_NOT_DRAFT. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiOkResponse({ type: EventItemResponseDto })
  @ApiErrors('EVENT_ITEM_NOT_DRAFT', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async publish(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
  ): Promise<EventItemResponseDto> {
    const view = await this.publishEventItemUseCase.execute({ actor, eventId, itemId })
    return { data: EventItemPresenter.toJson(view) }
  }

  @Post('items/:itemId/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancelar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event cancela um Event item publicado: ele continua na programação com o estado CANCELLED e fica congelado (sem edição nem remoção) até ser descancelado. A mudança de estado vira uma Change no Change log, gravada junto com o cancelamento. Um item em Draft não é cancelado, é apagado: 409 EVENT_ITEM_NOT_PUBLISHED; um já Cancelled: 409 EVENT_ITEM_CANCELLED. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiOkResponse({ type: EventItemResponseDto })
  @ApiErrors(
    'EVENT_ITEM_NOT_PUBLISHED',
    'EVENT_ITEM_CANCELLED',
    'EVENT_CANCELLED',
    'FORBIDDEN',
    'NOT_FOUND',
  )
  async cancel(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
  ): Promise<EventItemResponseDto> {
    const view = await this.cancelEventItemUseCase.execute({ actor, eventId, itemId })
    return { data: EventItemPresenter.toJson(view) }
  }

  @Post('items/:itemId/uncancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Descancelar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event descancela um Event item Cancelled: ele volta a publicado e aceita escritas de novo. A mudança de estado vira uma Change no Change log, gravada junto com o descancelamento. Um item que não está Cancelled: 409 EVENT_ITEM_NOT_CANCELLED. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiOkResponse({ type: EventItemResponseDto })
  @ApiErrors('EVENT_ITEM_NOT_CANCELLED', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async uncancel(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
  ): Promise<EventItemResponseDto> {
    const view = await this.uncancelEventItemUseCase.execute({ actor, eventId, itemId })
    return { data: EventItemPresenter.toJson(view) }
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Apagar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event apaga o item, em Draft ou publicado. A remoção vira uma Change no Change log. Um item Cancelled está congelado até ser descancelado: 409 EVENT_ITEM_CANCELLED. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiNoContentResponse()
  @ApiErrors('EVENT_ITEM_CANCELLED', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async delete(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
  ): Promise<void> {
    await this.deleteEventItemUseCase.execute({ actor, eventId, itemId })
  }

  @Get('schedule')
  @ApiOperation({
    summary: 'Ler a programação do Event',
    description:
      'Um Group member ou o Super admin lê a programação do Event, só com os itens que o alcançam (a regra de alcance): o Super admin e os Owners veem todos, e um Viewer, só os publicados e os cancelados de um Event publicado de que é Participant; para o Viewer que não é Participant, ou num Event em Draft, a programação vem vazia (onde e quando são do Event). A programação tem a General info (itens sem data, na ordem da produção) e a Timeline (só os dias com itens, em ordem de data, mesmo fora do período; em cada dia, primeiro os sem hora, na ordem da produção, depois os com hora, pela hora e, na mesma hora, na ordem da produção). O dia de um item é a data dele no calendário. Cada item traz o estado: DRAFT (só os Owners o veem), PUBLISHED ou CANCELLED (continua na programação, com o selo de cancelado). Quem não é Group member do Group recebe 404.',
  })
  @ApiOkResponse({ type: ScheduleResponseDto })
  @ApiErrors('NOT_FOUND')
  async schedule(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.getScheduleUseCase.execute({ actor, eventId })
    return { data: EventItemPresenter.scheduleToJson(schedule) }
  }
}
