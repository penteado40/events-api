import { Body, Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case.js'
import { IssueActivationLinkUseCase } from '../application/use-cases/issue-activation-link.use-case.js'
import type { User } from '../domain/user.entity.js'
import {
  ActivationLinkResponseDto,
  CreateUserDto,
  CreateUserResponseDto,
} from './dto/user-management.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly issueActivationLinkUseCase: IssueActivationLinkUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar um User',
    description:
      'Só o Super admin. O User nasce Pending user e a resposta traz o Activation link, pelo qual ele fica ativo ao entrar pela primeira vez com este email.',
  })
  @ApiCreatedResponse({ type: CreateUserResponseDto })
  @ApiErrors('FORBIDDEN', 'EMAIL_ALREADY_IN_USE')
  async createUser(
    @CurrentUser() actor: User,
    @Body() body: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    const { user, activationLink } = await this.createUserUseCase.execute({ actor, ...body })
    return {
      data: {
        user: UserPresenter.toJson(user),
        activationLink: UserPresenter.toActivationLinkJson(activationLink),
      },
    }
  }

  @Post(':id/activation-link')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Reemitir o Activation link',
    description:
      'Só o Super admin, para um Pending user. O Activation link anterior deixa de valer; o novo vai por email ao Pending user e volta na resposta, para repassar por outro meio.',
  })
  @ApiCreatedResponse({ type: ActivationLinkResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'USER_ALREADY_ACTIVE')
  async issueActivationLink(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) userId: number,
  ): Promise<ActivationLinkResponseDto> {
    const link = await this.issueActivationLinkUseCase.execute({ actor, userId })
    return { data: UserPresenter.toActivationLinkJson(link) }
  }
}
