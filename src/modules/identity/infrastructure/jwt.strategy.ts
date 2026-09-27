import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AppError } from '../../../shared/domain/app-error.js'
import { AppConfig } from '../../../shared/infrastructure/app-config.js'
import { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case.js'
import type { User } from '../domain/user.entity.js'
import type { SessionTokenPayload } from './jwt-token-issuer.js'

/** Loads the User on every request, so deleted Users and old sessions are refused. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfig,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwtSecret,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    })
  }

  validate(payload: SessionTokenPayload): Promise<User> {
    const userId = Number(payload.sub)
    if (!Number.isSafeInteger(userId)) throw new AppError('UNAUTHENTICATED')
    return this.getCurrentUser.execute({ userId, issuedAt: payload.iat })
  }
}
