import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { AppError } from '../../../shared/domain/app-error.js'
import { Public } from '../../../shared/presentation/public.decorator.js'
import { LoginUseCase } from '../application/use-cases/login.use-case.js'
import { TokenRequestSchema } from './dto/token-request.dto.js'

type OAuthError = 'invalid_request' | 'unsupported_grant_type' | 'invalid_grant'

/**
 * OAuth2 password grant (RFC 6749 §4.3) for the Scalar login only. Registered
 * only with DOCS_ENABLED=true and deliberately outside the `{ data }` /
 * `{ error: { code } }` envelope (ADR-0008).
 */
@ApiExcludeController()
@Controller('auth')
export class TokenController {
  constructor(private readonly login: LoginUseCase) {}

  @Public()
  @Post('token')
  @HttpCode(200)
  async token(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')

    const parsed = TokenRequestSchema.safeParse(body)
    if (!parsed.success) return fail(res, 'invalid_request')
    if (parsed.data.grant_type !== 'password') return fail(res, 'unsupported_grant_type')

    try {
      const { token, expiresIn } = await this.login.execute({
        email: parsed.data.username,
        password: parsed.data.password,
      })
      return { access_token: token, token_type: 'bearer', expires_in: expiresIn }
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.code === 'INVALID_CREDENTIALS' || error.code === 'USER_PENDING')
      ) {
        return fail(res, 'invalid_grant')
      }
      throw error
    }
  }
}

function fail(res: Response, error: OAuthError) {
  res.status(400)
  return { error }
}
