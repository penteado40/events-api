import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOAuth2, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case.js'
import type { User } from '../domain/user.entity.js'
import { LoginResponseDto } from './dto/login.dto.js'
import { ChangePasswordDto } from './dto/password.dto.js'
import { MeResponseDto } from './dto/user.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@ApiBearerAuth()
@ApiOAuth2([], 'oauth2')
@Controller('me')
export class MeController {
  constructor(private readonly changePassword: ChangePasswordUseCase) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: User): MeResponseDto {
    return { data: UserPresenter.toJson(user) }
  }

  /** Revokes every other session; the returned token keeps this device logged in. */
  @Patch('password')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async updatePassword(
    @CurrentUser() user: User,
    @Body() body: ChangePasswordDto,
  ): Promise<LoginResponseDto> {
    const result = await this.changePassword.execute({ user, ...body })
    return { data: { token: result.token, user: UserPresenter.toJson(result.user) } }
  }
}
