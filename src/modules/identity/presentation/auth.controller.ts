import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../../../shared/presentation/public.decorator.js'
import { LoginUseCase } from '../application/use-cases/login.use-case.js'
import { LoginDto, LoginResponseDto } from './dto/login.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    const { token, user } = await this.loginUseCase.execute(body)
    return { data: { token, user: UserPresenter.toJson(user) } }
  }
}
