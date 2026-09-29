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
      'Só o Super admin. O User nasce Pending user, sem senha; entregue o `activationToken` para ele se ativar.',
  })
  @ApiCreatedResponse({ type: CreateUserResponseDto })
  @ApiErrors('FORBIDDEN', 'EMAIL_ALREADY_IN_USE')
  async createUser(
    @CurrentUser() actor: User,
    @Body() body: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    const { user, activationToken, expiresAt } = await this.createUserUseCase.execute({
      actor,
      ...body,
    })
    return {
      data: {
        user: UserPresenter.toJson(user),
        activationToken,
        expiresAt: expiresAt.toISOString(),
      },
    }
  }

  @Post(':id/activation-link')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Reemitir o Activation link',
    description: 'Só o Super admin, para um Pending user. O link anterior deixa de valer.',
  })
  @ApiCreatedResponse({ type: ActivationLinkResponseDto })
  @ApiErrors('FORBIDDEN', 'NOT_FOUND', 'USER_ALREADY_ACTIVE')
  async issueActivationLink(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) userId: number,
  ): Promise<ActivationLinkResponseDto> {
    const { activationToken, expiresAt } = await this.issueActivationLinkUseCase.execute({
      actor,
      userId,
    })
    return { data: { activationToken, expiresAt: expiresAt.toISOString() } }
  }
}
