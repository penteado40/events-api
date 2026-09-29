import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case.js'
import type { User } from '../domain/user.entity.js'
import { LoginResponseDto } from './dto/login.dto.js'
import { ChangePasswordDto } from './dto/password.dto.js'
import { MeResponseDto } from './dto/user.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly changePasswordUseCase: ChangePasswordUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Ver o User logado' })
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: User): MeResponseDto {
    return { data: UserPresenter.toJson(user) }
  }

  @Patch('password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Trocar a própria senha',
    description:
      'Encerra todas as outras sessões; o token devolvido mantém este dispositivo logado.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrors('WEAK_PASSWORD', 'INVALID_CURRENT_PASSWORD')
  async changePassword(
    @CurrentUser() user: User,
    @Body() body: ChangePasswordDto,
  ): Promise<LoginResponseDto> {
    const result = await this.changePasswordUseCase.execute({ user, ...body })
    return { data: { token: result.token, user: UserPresenter.toJson(result.user) } }
  }
}
