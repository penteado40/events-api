import { type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AppError } from '../domain/app-error.js'
import { IS_PUBLIC_KEY } from './public.decorator.js'

/**
 * Global guard: every route requires a valid `Authorization: Bearer` JWT unless
 * marked `@Public()` (ADR-0008); the Site's `X-Api-Key` left with the Sites
 * (ADR-0016). Missing, invalid and expired credentials all become
 * UNAUTHENTICATED.
 */
@Injectable()
export class CredentialsGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return (await super.canActivate(context)) as boolean
  }

  override handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (user && !err) return user
    if (!err || err instanceof AppError) throw new AppError('UNAUTHENTICATED')
    throw err
  }
}
