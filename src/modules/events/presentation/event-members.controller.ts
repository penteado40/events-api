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
import { AddEventMemberUseCase } from '../application/use-cases/add-event-member.use-case.js'
import { ChangeEventMemberRoleUseCase } from '../application/use-cases/change-event-member-role.use-case.js'
import { IssueMemberActivationLinkUseCase } from '../application/use-cases/issue-member-activation-link.use-case.js'
import { ListEventMembersUseCase } from '../application/use-cases/list-event-members.use-case.js'
import { RemoveEventMemberUseCase } from '../application/use-cases/remove-event-member.use-case.js'
import { TransferPrimaryOwnerUseCase } from '../application/use-cases/transfer-primary-owner.use-case.js'
import {
  AddEventMemberDto,
  AddEventMemberResponseDto,
  ChangeEventMemberRoleDto,
  EventMemberListResponseDto,
  EventMemberResponseDto,
  MemberActivationLinkResponseDto,
  TransferPrimaryOwnerDto,
} from './dto/event-member.dto.js'
import { EventMemberPresenter } from './event-member.presenter.js'
import { EVENT_ACCESS_ERRORS } from './event-access-errors.js'

@ApiTags('event members')
@Controller('events/:id/members')
export class EventMembersController {
  constructor(
    private readonly listEventMembersUseCase: ListEventMembersUseCase,
    private readonly addEventMemberUseCase: AddEventMemberUseCase,
    private readonly changeEventMemberRoleUseCase: ChangeEventMemberRoleUseCase,
    private readonly removeEventMemberUseCase: RemoveEventMemberUseCase,
    private readonly transferPrimaryOwnerUseCase: TransferPrimaryOwnerUseCase,
    private readonly issueMemberActivationLinkUseCase: IssueMemberActivationLinkUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar os Event members', description: 'Qualquer Event member.' })
  @ApiOkResponse({ type: EventMemberListResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS)
  async list(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<EventMemberListResponseDto> {
    const result = await this.listEventMembersUseCase.execute({ actor, eventId })
    return { data: result.map(EventMemberPresenter.toJson) }
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Adicionar um Event member',
    description:
      'Owners e o Super admin, por email. Se o email já tem User, ele só é vinculado; se não, nasce um Pending user e a resposta traz o `activationToken` para entregar à pessoa.',
  })
  @ApiCreatedResponse({ type: AddEventMemberResponseDto })
  @ApiErrors(
    ...EVENT_ACCESS_ERRORS,
    'EVENT_ARCHIVED',
    'MEMBER_ALREADY_EXISTS',
    'USER_IS_SUPER_ADMIN',
  )
  async add(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Body() body: AddEventMemberDto,
  ): Promise<AddEventMemberResponseDto> {
    const { activation, ...view } = await this.addEventMemberUseCase.execute({
      actor,
      eventId,
      ...body,
    })
    return {
      data: {
        ...EventMemberPresenter.toJson(view),
        activation: activation && EventMemberPresenter.activationLinkToJson(activation),
      },
    }
  }

  @Post('transfer-primary')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Transferir o posto de Primary owner',
    description:
      'O Primary owner (ou o Super admin) passa o posto a outro Owner; o antigo segue como Owner organizador. Devolve todos os Event members.',
  })
  @ApiOkResponse({ type: EventMemberListResponseDto })
  @ApiErrors(
    ...EVENT_ACCESS_ERRORS,
    'EVENT_ARCHIVED',
    'MEMBER_NOT_FOUND',
    'TRANSFER_TARGET_NOT_OWNER',
    'MEMBER_CHANGED',
  )
  async transferPrimary(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Body() body: TransferPrimaryOwnerDto,
  ): Promise<EventMemberListResponseDto> {
    const result = await this.transferPrimaryOwnerUseCase.execute({
      actor,
      eventId,
      userId: body.userId,
    })
    return { data: result.map(EventMemberPresenter.toJson) }
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Mudar o papel de um Event member',
    description:
      'Owners e o Super admin. Só o Primary owner (ou o Super admin) rebaixa outro Owner; o Primary owner precisa transferir o posto antes de se rebaixar.',
  })
  @ApiOkResponse({ type: EventMemberResponseDto })
  @ApiErrors(
    ...EVENT_ACCESS_ERRORS,
    'EVENT_ARCHIVED',
    'MEMBER_NOT_FOUND',
    'PRIMARY_OWNER_MUST_TRANSFER',
    'MEMBER_CHANGED',
  )
  async changeRole(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: ChangeEventMemberRoleDto,
  ): Promise<EventMemberResponseDto> {
    const result = await this.changeEventMemberRoleUseCase.execute({
      actor,
      eventId,
      userId,
      role: body.role,
    })
    return { data: EventMemberPresenter.toJson(result) }
  }

  @Delete(':userId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remover um Event member',
    description:
      'Owners removem membros; qualquer membro sai removendo a si mesmo. Só o Primary owner (ou o Super admin) remove outro Owner, e o Primary owner não sai sem transferir o posto.',
  })
  @ApiNoContentResponse()
  @ApiErrors(
    ...EVENT_ACCESS_ERRORS,
    'EVENT_ARCHIVED',
    'MEMBER_NOT_FOUND',
    'PRIMARY_OWNER_MUST_TRANSFER',
    'MEMBER_CHANGED',
  )
  async remove(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    await this.removeEventMemberUseCase.execute({ actor, eventId, userId })
  }

  @Post(':userId/activation-link')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Reemitir o Activation link de um Event member',
    description:
      'Owners e o Super admin, para um Pending user que é membro do Event. O link anterior deixa de valer, quem quer que o tenha emitido.',
  })
  @ApiCreatedResponse({ type: MemberActivationLinkResponseDto })
  @ApiErrors(...EVENT_ACCESS_ERRORS, 'EVENT_ARCHIVED', 'MEMBER_NOT_FOUND', 'USER_ALREADY_ACTIVE')
  async issueActivationLink(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) eventId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<MemberActivationLinkResponseDto> {
    const link = await this.issueMemberActivationLinkUseCase.execute({ actor, eventId, userId })
    return { data: EventMemberPresenter.activationLinkToJson(link) }
  }
}
