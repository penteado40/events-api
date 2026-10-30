import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/** The User that the global CredentialsGuard put on the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<Request & { user?: unknown }>().user,
)
