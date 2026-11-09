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
import { AddOwnerUseCase } from '../application/use-cases/add-owner.use-case.js'
import { AddViewerUseCase } from '../application/use-cases/add-viewer.use-case.js'
import { CreateGroupUseCase } from '../application/use-cases/create-group.use-case.js'
import { DemoteOwnerUseCase } from '../application/use-cases/demote-owner.use-case.js'
import { DemoteSelfUseCase } from '../application/use-cases/demote-self.use-case.js'
import { GetGroupUseCase } from '../application/use-cases/get-group.use-case.js'
import { LeaveGroupUseCase } from '../application/use-cases/leave-group.use-case.js'
import { ListGroupsUseCase } from '../application/use-cases/list-groups.use-case.js'
import { PromoteToOwnerUseCase } from '../application/use-cases/promote-to-owner.use-case.js'
import { RemoveOwnerUseCase } from '../application/use-cases/remove-owner.use-case.js'
import { ReissueActivationLinkUseCase } from '../application/use-cases/reissue-activation-link.use-case.js'
import { RenameGroupUseCase } from '../application/use-cases/rename-group.use-case.js'
import {
  ActivationLinkResponseDto,
  AddOwnerDto,
  AddOwnerResponseDto,
  AddViewerDto,
  AddViewerResponseDto,
  CreateGroupDto,
  GroupListResponseDto,
  GroupResponseDto,
  GroupRoleResponseDto,
  RenameGroupDto,
} from './dto/group.dto.js'
import { GroupPresenter } from './group.presenter.js'

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly createGroupUseCase: CreateGroupUseCase,
    private readonly listGroupsUseCase: ListGroupsUseCase,
    private readonly renameGroupUseCase: RenameGroupUseCase,
    private readonly getGroupUseCase: GetGroupUseCase,
    private readonly addOwnerUseCase: AddOwnerUseCase,
    private readonly removeOwnerUseCase: RemoveOwnerUseCase,
    private readonly demoteOwnerUseCase: DemoteOwnerUseCase,
    private readonly promoteToOwnerUseCase: PromoteToOwnerUseCase,
    private readonly leaveGroupUseCase: LeaveGroupUseCase,
    private readonly demoteSelfUseCase: DemoteSelfUseCase,
    private readonly addViewerUseCase: AddViewerUseCase,
    private readonly reissueActivationLinkUseCase: ReissueActivationLinkUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um Group',
    description:
      'Só o Super admin. O Group nasce sem Group members, até o Super admin definir o primeiro Owner.',
  })
  @ApiCreatedResponse({ type: GroupResponseDto })
  @ApiErrors('FORBIDDEN')
  async create(
    @CurrentUser() actor: User,
    @Body() body: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    const group = await this.createGroupUseCase.execute({ actor, name: body.name })
    return { data: GroupPresenter.toJson(group) }
  }

  @Get()
  @ApiOperation({
    summary: 'Listar os Groups',
    description: 'O Super admin vê todos; um User vê os Groups de que é Group member. Por nome.',
  })
  @ApiOkResponse({ type: GroupListResponseDto })
  @ApiErrors()
  async list(@CurrentUser() actor: User): Promise<GroupListResponseDto> {
    const groups = await this.listGroupsUseCase.execute({ actor })
    return { data: groups.map(GroupPresenter.toJson) }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver um Group',
    description:
      'O Super admin vê qualquer um; um User, só os Groups de que é Group member (404 nos demais).',
  })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiErrors('NOT_FOUND')
  async get(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
  ): Promise<GroupResponseDto> {
    const group = await this.getGroupUseCase.execute({ actor, groupId })
    return { data: GroupPresenter.toJson(group) }
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Renomear um Group',
    description:
      'Só o Super admin. Quem não é Group member do Group recebe 404; um Group member, 403.',
  })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND')
  async rename(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Body() body: RenameGroupDto,
  ): Promise<GroupResponseDto> {
    const group = await this.renameGroupUseCase.execute({ actor, groupId, name: body.name })
    return { data: GroupPresenter.toJson(group) }
  }

  @Post(':id/owners')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Definir um Owner do Group',
    description:
      "Só o Super admin (ADR-0017). Dá o papel de Owner pelo email; se o email ainda não tem User, nasce um Pending user com o nome e o telefone informados, e a resposta traz o Activation link. Quem entra recebe um só email, enviado depois da resposta e com o seu 'replyTo' em quem fez a ação: o Activation link de Group para o Pending user criado agora, o Group access para os demais (User ativo, ou Pending user que já tinha um link). Quem não é Group member do Group recebe 404; um Group member, 403.",
  })
  @ApiCreatedResponse({ type: AddOwnerResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'ALREADY_A_GROUP_MEMBER', 'SUPER_ADMIN_NOT_A_GROUP_MEMBER')
  async addOwner(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Body() body: AddOwnerDto,
  ): Promise<AddOwnerResponseDto> {
    const { member, user, activationLink } = await this.addOwnerUseCase.execute({
      actor,
      inviter: { email: actor.email.value },
      groupId,
      ...body,
    })
    return {
      data: {
        member: GroupPresenter.toMemberJson(member, user),
        activationLink: activationLink && GroupPresenter.toActivationLinkJson(activationLink),
      },
    }
  }

  @Delete(':id/owners/:userId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Tirar um Owner do Group',
    description:
      'Só o Super admin (ADR-0017). Nunca o último Owner (409 LAST_OWNER): defina outro antes. Se o User do caminho não é Owner do Group, 404. Quanto a quem chama: quem não é Group member do Group recebe 404; um Group member, 403.',
  })
  @ApiNoContentResponse()
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'LAST_OWNER')
  async removeOwner(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    await this.removeOwnerUseCase.execute({ actor, groupId, userId })
  }

  @Post(':id/owners/:userId/demote')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rebaixar um Owner a Viewer',
    description:
      'Só o Super admin (ADR-0017). Nunca o último Owner (409 LAST_OWNER). Se o User do caminho não é Owner do Group, 404. Quanto a quem chama: quem não é Group member do Group recebe 404; um Group member, 403.',
  })
  @ApiOkResponse({ type: GroupRoleResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'LAST_OWNER')
  async demoteOwner(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GroupRoleResponseDto> {
    const member = await this.demoteOwnerUseCase.execute({ actor, groupId, userId })
    return { data: GroupPresenter.toRoleJson(member) }
  }

  @Post(':id/members/:userId/promote')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Promover um Viewer a Owner',
    description:
      'Só o Super admin (ADR-0017). Num Group que nasceu sem Owner, é o primeiro. Um Owner continua Owner, sem nada a gravar. Se o User do caminho não é Group member do Group, 404. Quanto a quem chama: quem não é Group member do Group recebe 404; um Group member, 403.',
  })
  @ApiOkResponse({ type: GroupRoleResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND')
  async promoteToOwner(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GroupRoleResponseDto> {
    const member = await this.promoteToOwnerUseCase.execute({ actor, groupId, userId })
    return { data: GroupPresenter.toRoleJson(member) }
  }

  @Post(':id/leave')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sair do Group (Owner)',
    description:
      'Um Owner sai do Group, menos o último (409 LAST_OWNER). Viewers não saem por conta própria e o Super admin não é Group member (403). Quem não é Group member do Group recebe 404.',
  })
  @ApiNoContentResponse()
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'LAST_OWNER')
  async leave(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
  ): Promise<void> {
    await this.leaveGroupUseCase.execute({ actor, groupId })
  }

  @Post(':id/demote-self')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rebaixar-se a Viewer (Owner)',
    description:
      'Um Owner passa a Viewer, menos o último (409 LAST_OWNER). Um Viewer ou o Super admin recebe 403; quem não é Group member do Group, 404.',
  })
  @ApiOkResponse({ type: GroupRoleResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'LAST_OWNER')
  async demoteSelf(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
  ): Promise<GroupRoleResponseDto> {
    const member = await this.demoteSelfUseCase.execute({ actor, groupId })
    return { data: GroupPresenter.toRoleJson(member) }
  }

  @Post(':id/viewers')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Adicionar um Viewer ao Group',
    description:
      "O Super admin ou um Owner do Group. Adiciona a pessoa como Viewer pelo email; se o email ainda não tem User, nasce um Pending user com o nome e o telefone informados, e a resposta traz o Activation link. Quem entra recebe um só email, enviado depois da resposta e com o seu 'replyTo' em quem fez a ação: o Activation link de Group para o Pending user criado agora, o Group access para os demais (User ativo, ou Pending user que já tinha um link). Quem não é Group member do Group recebe 404; um Viewer, 403.",
  })
  @ApiCreatedResponse({ type: AddViewerResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'ALREADY_A_GROUP_MEMBER', 'SUPER_ADMIN_NOT_A_GROUP_MEMBER')
  async addViewer(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Body() body: AddViewerDto,
  ): Promise<AddViewerResponseDto> {
    const { member, user, activationLink } = await this.addViewerUseCase.execute({
      actor,
      inviter: { email: actor.email.value },
      groupId,
      ...body,
    })
    return {
      data: {
        member: GroupPresenter.toMemberJson(member, user),
        activationLink: activationLink && GroupPresenter.toActivationLinkJson(activationLink),
      },
    }
  }

  @Post(':id/members/:userId/activation-link')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Gerar novo Activation link para um Group member pendente',
    description:
      "O Super admin ou um Owner do Group, quando o convite não chegou. O Activation link anterior deixa de valer; o novo volta na resposta, para repassar por outro meio, e vai por email à pessoa, enviado depois da resposta e com o seu 'replyTo' em quem fez a ação. Quem já entrou pelo Activation link recebe 409 USER_ALREADY_ACTIVE; se o User do caminho não é Group member do Group, 404. Quanto a quem chama: quem não é Group member do Group recebe 404; um Viewer, 403.",
  })
  @ApiCreatedResponse({ type: ActivationLinkResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'USER_ALREADY_ACTIVE')
  async reissueActivationLink(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ActivationLinkResponseDto> {
    const { activationLink } = await this.reissueActivationLinkUseCase.execute({
      actor,
      inviter: { email: actor.email.value },
      groupId,
      userId,
    })
    return { data: GroupPresenter.toActivationLinkJson(activationLink) }
  }
}
