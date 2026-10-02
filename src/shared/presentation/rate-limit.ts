import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { RateLimitPolicyName } from '../application/rate-limit-policies.js'
import { RateLimiter } from '../application/rate-limiter.js'

const RATE_LIMIT_POLICY = 'rateLimitPolicy'

/**
 * Limits the route per client IP under `policy`; past it, 429 RATE_LIMITED.
 * The route's `@ApiErrors` lists RATE_LIMITED.
 */
export const RateLimit = (policy: RateLimitPolicyName) =>
  applyDecorators(SetMetadata(RATE_LIMIT_POLICY, policy), UseGuards(RateLimitGuard))

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<RateLimitPolicyName>(RATE_LIMIT_POLICY, context.getHandler())
    const request = context.switchToHttp().getRequest<Request>()
    // With `trust proxy` (on Vercel), Express reads it from x-forwarded-for.
    await this.limiter.consume(policy, request.ip ?? 'unknown')
    return true
  }
}
