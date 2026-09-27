import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/** The authenticated principal that the Passport strategy put on the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<Request>().user,
)
