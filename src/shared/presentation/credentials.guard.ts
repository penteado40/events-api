import { type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AppError } from '../domain/app-error.js'
import {
  ACCEPTS_API_KEY,
  API_KEY_HEADER,
  ApiKeyAuthenticator,
  type RequestWithApiKey,
} from './api-key.js'
import { IS_PUBLIC_KEY } from './public.decorator.js'

/**
 * Global guard: every route requires a valid JWT unless marked `@Public()`. A
 * route marked `@AcceptsApiKey()` also takes the Site's `X-Api-Key`, which then
 * decides alone; elsewhere the header is ignored (ADR-0008). Missing, invalid,
 * expired and revoked credentials all become UNAUTHENTICATED.
 */
@Injectable()
export class CredentialsGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeyAuthenticator,
  ) {
    super()
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.marked(IS_PUBLIC_KEY, context)) return true

    const request = context.switchToHttp().getRequest<RequestWithApiKey>()
    const apiKey = request.header(API_KEY_HEADER)
    if (apiKey !== undefined && this.marked(ACCEPTS_API_KEY, context)) {
      request.apiKey = await this.apiKeys.authenticate(apiKey)
      return true
    }
    return (await super.canActivate(context)) as boolean
  }

  override handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (user && !err) return user
    if (!err || err instanceof AppError) throw new AppError('UNAUTHENTICATED')
    throw err
  }

  private marked(key: string, context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(key, [
      context.getHandler(),
      context.getClass(),
    ])
  }
}
