import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/** A request after the global guard: it carries the User the token belongs to. */
export type AuthenticatedRequest<TUser = unknown> = Request & { user?: TUser }

/** The User that the global CredentialsGuard put on the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)
