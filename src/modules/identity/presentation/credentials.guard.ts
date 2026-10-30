import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { AppError } from '../../../shared/domain/app-error.js'
import { IS_PUBLIC_KEY } from '../../../shared/presentation/public.decorator.js'
import { AuthenticateUseCase } from '../application/use-cases/authenticate.use-case.js'
import type { User } from '../domain/user.entity.js'

const BEARER = /^Bearer\s+(\S+)$/i

/**
 * Global guard: every route requires the Clerk session token in
 * `Authorization: Bearer` unless marked `@Public()` (ADR-0008, ADR-0020), and
 * puts the User on the request for `@CurrentUser()`. A missing or refused
 * token is UNAUTHENTICATED; the JWT of the old login is no longer accepted.
 */
@Injectable()
export class CredentialsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request & { user?: User }>()
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1]
    if (!token) throw new AppError('UNAUTHENTICATED')
    request.user = await this.authenticate.execute({ token })
    return true
  }
}
