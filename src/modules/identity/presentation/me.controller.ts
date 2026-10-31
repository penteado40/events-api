import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../../../shared/presentation/api-errors.decorator.js'
import { CurrentUser } from '../../../shared/presentation/current-user.decorator.js'
import { UpdateMeUseCase } from '../application/use-cases/update-me.use-case.js'
import type { User } from '../domain/user.entity.js'
import { MeResponseDto, UpdateMeDto } from './dto/user.dto.js'
import { UserPresenter } from './user.presenter.js'

@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly updateMeUseCase: UpdateMeUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Ver o User logado' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiErrors()
  me(@CurrentUser() user: User): MeResponseDto {
    return { data: UserPresenter.toJson(user) }
  }

  @Patch()
  @ApiOperation({
    summary: 'Editar o próprio nome e telefone',
    description:
      'Só o que vier no corpo muda. O email vem do Clerk e não se edita aqui: um corpo com `email` responde 400.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiErrors()
  async updateMe(@CurrentUser() actor: User, @Body() body: UpdateMeDto): Promise<MeResponseDto> {
    const user = await this.updateMeUseCase.execute({ actor, ...body })
    return { data: UserPresenter.toJson(user) }
  }
}
