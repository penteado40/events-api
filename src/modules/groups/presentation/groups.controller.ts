import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import type { User } from '../../identity/index.js'
import { AddOwnerUseCase } from '../application/use-cases/add-owner.use-case.js'
import { CreateGroupUseCase } from '../application/use-cases/create-group.use-case.js'
import { GetGroupUseCase } from '../application/use-cases/get-group.use-case.js'
import { ListGroupsUseCase } from '../application/use-cases/list-groups.use-case.js'
import { RenameGroupUseCase } from '../application/use-cases/rename-group.use-case.js'
import {
  AddOwnerDto,
  AddOwnerResponseDto,
  CreateGroupDto,
  GroupListResponseDto,
  GroupResponseDto,
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
      'Só o Super admin (ADR-0017). Dá o papel de Owner pelo email; se o email ainda não tem User, nasce um Pending user com o nome e o telefone informados, e a resposta traz o Activation link. Quem não é Group member do Group recebe 404; um Group member, 403.',
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
}
