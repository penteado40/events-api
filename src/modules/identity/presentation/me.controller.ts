import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import type { User } from '../domain/user.entity.js'
import { MeResponseDto } from './dto/user.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Ver o User logado' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiErrors()
  me(@CurrentUser() user: User): MeResponseDto {
    return { data: UserPresenter.toJson(user) }
  }
}
