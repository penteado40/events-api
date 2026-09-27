import { type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AppError } from '../domain/app-error.js'
import { IS_PUBLIC_KEY } from './public.decorator.js'

/**
 * Global guard: every route requires a valid JWT unless marked `@Public()`.
 * Missing, invalid, expired and revoked tokens all become UNAUTHENTICATED.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context)
  }

  override handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (user && !err) return user
    if (!err || err instanceof AppError) throw new AppError('UNAUTHENTICATED')
    throw err
  }
}
