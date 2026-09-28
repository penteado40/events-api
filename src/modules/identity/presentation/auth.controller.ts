import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../../../shared/presentation/public.decorator.js'
import { ActivateUserUseCase } from '../application/use-cases/activate-user.use-case.js'
import { LoginUseCase } from '../application/use-cases/login.use-case.js'
import { LoginDto, LoginResponseDto } from './dto/login.dto.js'
import { ActivateDto } from './dto/password.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly activateUser: ActivateUserUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    const { token, user } = await this.loginUseCase.execute(body)
    return { data: { token, user: UserPresenter.toJson(user) } }
  }

  /** A Pending user sets their password with the Activation link token and is logged in. */
  @Public()
  @Post('activate')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async activate(@Body() body: ActivateDto): Promise<LoginResponseDto> {
    const { token, user } = await this.activateUser.execute(body)
    return { data: { token, user: UserPresenter.toJson(user) } }
  }
}
