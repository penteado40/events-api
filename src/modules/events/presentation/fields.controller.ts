import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Put } from '@nestjs/common'
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
import { CreateFieldUseCase } from '../application/use-cases/create-field.use-case.js'
import { DeleteFieldUseCase } from '../application/use-cases/delete-field.use-case.js'
import { EditFieldUseCase } from '../application/use-cases/edit-field.use-case.js'
import { ReorderFieldsUseCase } from '../application/use-cases/reorder-fields.use-case.js'
import {
  CreateFieldDto,
  EditFieldDto,
  FieldResponseDto,
  FieldsResponseDto,
  ReorderFieldsDto,
} from './dto/field.dto.js'
import { FieldPresenter } from './field.presenter.js'

/** Who may and what freezes, said once for every route of the Fields. */
const ACCESS =
  'Item de outro Event ou Field de outro item: 404. Quem não é Group member do Group recebe 404; um Viewer, 403. Num Event Cancelled, 409 EVENT_CANCELLED; num item Cancelled, 409 EVENT_ITEM_CANCELLED: o Field está congelado com o item.'

@ApiTags('event items')
@Controller('events/:id/items/:itemId/fields')
export class FieldsController {
  constructor(
    private readonly createFieldUseCase: CreateFieldUseCase,
    private readonly editFieldUseCase: EditFieldUseCase,
    private readonly deleteFieldUseCase: DeleteFieldUseCase,
    private readonly reorderFieldsUseCase: ReorderFieldsUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Field num Event item',
    description: `O Super admin ou um Owner do Group do Event adiciona ao Event item um Field com nome e valor, por último entre os Fields dele. O tipo é escolhido ao criar e não muda: TEXT, com o texto em value (lista, telefone e link são texto), ou PEOPLE, com os User ids em userIds, na ordem. O valor pode ser vazio. Só Participants do Event entram num Field PEOPLE: quem não é, 409 NOT_A_PARTICIPANT. Quem está num Field PEOPLE está no Audience do item enquanto estiver nele, mesmo fora do Audience escolhido. A criação é uma Change do item, que quem ele alcança vê, com o alcance de antes e o de depois. Responde as pessoas com o nome, na ordem. ${ACCESS}`,
  })
  @ApiCreatedResponse({ type: FieldResponseDto })
  @ApiErrors(
    'NOT_A_PARTICIPANT',
    'EVENT_ITEM_CANCELLED',
    'EVENT_CANCELLED',
    'FORBIDDEN',
    'NOT_FOUND',
  )
  async create(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
    @Body() body: CreateFieldDto,
  ): Promise<FieldResponseDto> {
    const field = await this.createFieldUseCase.execute({ actor, eventId, itemId, ...body })
    return { data: FieldPresenter.toJson(field) }
  }

  @Put('order')
  @ApiOperation({
    summary: 'Reordenar os Fields de um Event item',
    description: `O Super admin ou um Owner do Group do Event dá a nova ordem dos Fields do item: vêm todos, como estão agora; faltando algum, 409 FIELD_ORDER_INCOMPLETE (também quando outra escrita criou um antes). Responde os Fields na nova ordem. Reordenar é uma Change que só a produção vê; a mesma ordem não grava nada. ${ACCESS}`,
  })
  @ApiOkResponse({ type: FieldsResponseDto })
  @ApiErrors(
    'FIELD_ORDER_INCOMPLETE',
    'EVENT_ITEM_CANCELLED',
    'EVENT_CANCELLED',
    'FORBIDDEN',
    'NOT_FOUND',
  )
  async reorder(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
    @Body() body: ReorderFieldsDto,
  ): Promise<FieldsResponseDto> {
    const fields = await this.reorderFieldsUseCase.execute({
      actor,
      eventId,
      itemId,
      fieldIds: body.fieldIds,
    })
    return { data: fields.map(FieldPresenter.toJson) }
  }

  @Patch(':fieldId')
  @ApiOperation({
    summary: 'Editar um Field de um Event item',
    description: `O Super admin ou um Owner do Group do Event muda o nome ou o valor do Field: o texto de um TEXT (value) ou as pessoas de um PEOPLE (userIds, a lista inteira, na nova ordem); o que não é enviado não muda, e o tipo nunca muda: o valor do outro tipo, 400 VALIDATION_ERROR. Só Participants do Event entram: quem não é, 409 NOT_A_PARTICIPANT. Quem é posto no Field passa a ser alcançado pelo item; quem é tirado, se não está no Audience escolhido, deixa de ser. A edição é uma Change do item, com o antes e o depois e o alcance de antes e o de depois, que quem ele alcança vê; uma edição que não muda nada não grava nada. ${ACCESS}`,
  })
  @ApiOkResponse({ type: FieldResponseDto })
  @ApiErrors(
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
    @Param('fieldId', ParseIdPipe) fieldId: number,
    @Body() body: EditFieldDto,
  ): Promise<FieldResponseDto> {
    const field = await this.editFieldUseCase.execute({ actor, eventId, itemId, fieldId, ...body })
    return { data: FieldPresenter.toJson(field) }
  }

  @Delete(':fieldId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Apagar um Field de um Event item',
    description: `O Super admin ou um Owner do Group do Event apaga o Field. A remoção é uma Change do item, com o que o Field era. ${ACCESS}`,
  })
  @ApiNoContentResponse()
  @ApiErrors('EVENT_ITEM_CANCELLED', 'EVENT_CANCELLED', 'FORBIDDEN', 'NOT_FOUND')
  async delete(
    @CurrentUser() actor: User,
    @Param('id', ParseIdPipe) eventId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
    @Param('fieldId', ParseIdPipe) fieldId: number,
  ): Promise<void> {
    await this.deleteFieldUseCase.execute({ actor, eventId, itemId, fieldId })
  }
}
