import { Body, Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiOAuth2, ApiTags } from '@nestjs/swagger'
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
@ApiBearerAuth()
@ApiOAuth2([], 'oauth2')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly issueActivationLink: IssueActivationLinkUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: CreateUserResponseDto })
  async create(
    @CurrentUser() actor: User,
    @Body() body: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    const { user, activationToken, expiresAt } = await this.createUser.execute({ actor, ...body })
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
  @ApiCreatedResponse({ type: ActivationLinkResponseDto })
  async reissueActivationLink(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) userId: number,
  ): Promise<ActivationLinkResponseDto> {
    const { activationToken, expiresAt } = await this.issueActivationLink.execute({
      actor,
      userId,
    })
    return { data: { activationToken, expiresAt: expiresAt.toISOString() } }
  }
}
