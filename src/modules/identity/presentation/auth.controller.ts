import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { Public } from '../../../shared/presentation/public.decorator.js'
import { RateLimit } from '../../../shared/presentation/rate-limit.js'
import { ActivateUserUseCase } from '../application/use-cases/activate-user.use-case.js'
import { LoginUseCase } from '../application/use-cases/login.use-case.js'
import { LoginDto, LoginResponseDto } from './dto/login.dto.js'
import { ActivateUserDto } from './dto/password.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly activateUserUseCase: ActivateUserUseCase,
  ) {}

  @Public()
  @RateLimit('login-ip')
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entrar com email e senha' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrors('INVALID_CREDENTIALS', 'USER_PENDING', 'RATE_LIMITED')
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    const { token, user } = await this.loginUseCase.execute(body)
    return { data: { token, user: UserPresenter.toJson(user) } }
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ativar o User pelo Activation link',
    description:
      'O Pending user define a própria senha com o token do Activation link e já sai logado.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrors(
    'WEAK_PASSWORD',
    'ACTIVATION_LINK_INVALID',
    'ACTIVATION_LINK_USED',
    'ACTIVATION_LINK_EXPIRED',
  )
  async activateUser(@Body() body: ActivateUserDto): Promise<LoginResponseDto> {
    const { token, user } = await this.activateUserUseCase.execute(body)
    return { data: { token, user: UserPresenter.toJson(user) } }
  }
}
