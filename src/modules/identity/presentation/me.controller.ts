import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOAuth2, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import type { User } from '../domain/user.entity.js'
import { MeResponseDto } from './dto/user.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@ApiBearerAuth()
@ApiOAuth2([], 'oauth2')
@Controller('me')
export class MeController {
  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: User): MeResponseDto {
    return { data: UserPresenter.toJson(user) }
  }
}
