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
import { CreateEventItemUseCase } from '../application/use-cases/create-event-item.use-case.js'
import { DeleteEventItemUseCase } from '../application/use-cases/delete-event-item.use-case.js'
import { EditEventItemUseCase } from '../application/use-cases/edit-event-item.use-case.js'
import { GetScheduleUseCase } from '../application/use-cases/get-schedule.use-case.js'
import { ReorderEventItemsUseCase } from '../application/use-cases/reorder-event-items.use-case.js'
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
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly reorderEventItemsUseCase: ReorderEventItemsUseCase,
  ) {}

  @Post('items')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event. Num Event em Draft, o item nasce publicado. Data e hora de início são locais e opcionais, nunca convertidas; hora sem data: 400 EVENT_ITEM_TIME_WITHOUT_DATE. O lugar é opcional e, sem fuso próprio, vale o do Event. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
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
  @HttpCode(204)
  @ApiOperation({
    summary: 'Reordenar os Event items onde a hora não decide',
    description:
      'O Super admin ou um Owner do Group do Event dá a nova ordem da produção de um grupo de Event items onde a hora não decide: todos sem data (a General info), todos do mesmo dia sem hora ou todos do mesmo dia e hora. A ordem nunca passa por cima da hora. Vêm todos os itens do grupo, como ele está agora: itens de grupos diferentes, 400 EVENT_ITEM_ORDER_MIXED; faltando algum, 409 EVENT_ITEM_ORDER_INCOMPLETE. Item de outro Event: 404. Reordenar é uma Change do Event que só a produção vê; a mesma ordem não grava nada. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiNoContentResponse()
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
  ): Promise<void> {
    await this.reorderEventItemsUseCase.execute({ actor, eventId, itemIds: body.itemIds })
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Editar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event. O que não é enviado não muda; null apaga a data, a hora ou o lugar, e o lugar vai inteiro. O que sobra não pode ter hora sem data: 400 EVENT_ITEM_TIME_WITHOUT_DATE. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiOkResponse({ type: EventItemResponseDto })
  @ApiErrors('EVENT_ITEM_TIME_WITHOUT_DATE', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async edit(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
    @Body() body: EditEventItemDto,
  ): Promise<EventItemResponseDto> {
    const view = await this.editEventItemUseCase.execute({ actor, eventId, itemId, ...body })
    return { data: EventItemPresenter.toJson(view) }
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Apagar um Event item',
    description:
      'O Super admin ou um Owner do Group do Event. Item de outro Event: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, congelado: 409 EVENT_CANCELLED.',
  })
  @ApiNoContentResponse()
  @ApiErrors('EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
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
      'O Super admin ou um Owner do Group do Event lê a programação inteira: a General info (itens sem data, na ordem da produção) e a Timeline (só os dias com itens, em ordem de data, mesmo fora do período; em cada dia, primeiro os sem hora, na ordem da produção, depois os com hora, pela hora e, na mesma hora, na ordem da produção). O dia de um item é a data dele no calendário. Quem não é Group member do Group recebe 404; um Viewer, 403 por enquanto.',
  })
  @ApiOkResponse({ type: ScheduleResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND')
  async schedule(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.getScheduleUseCase.execute({ actor, eventId })
    return { data: EventItemPresenter.scheduleToJson(schedule) }
  }
}
