import { Controller, HttpCode, Logger, Post, Req } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Request } from 'express'
import { AppError } from '../../../shared/domain/app-error.js'
import { Public } from '../../../shared/presentation/public.decorator.js'
import { IdentityWebhookVerifier } from '../application/ports/identity-webhook-verifier.js'
import { SyncUserProfileUseCase } from '../application/use-cases/sync-user-profile.use-case.js'

/**
 * Clerk's webhook (ADR-0020): keeps the mirror of the User's name and email in
 * step. Public, since Clerk has no session token: the Svix signature over the
 * raw body is what authenticates it. Out of the docs, which are for people.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name)

  constructor(
    private readonly verifier: IdentityWebhookVerifier,
    private readonly syncUserProfile: SyncUserProfileUseCase,
  ) {}

  /** Answers 200 to every verified event, so Clerk does not retry one we chose to ignore. */
  @Post()
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<Request>): Promise<{ data: { received: true } }> {
    const event = request.rawBody
      ? this.verifier.verify({ rawBody: request.rawBody, headers: request.headers })
      : null
    if (!event) throw new AppError('UNAUTHENTICATED')

    const outcome = await this.syncUserProfile.execute(event)
    if (outcome === 'EMAIL_IN_USE' && event.type === 'USER_UPDATED') {
      this.logger.warn(
        `Clerk user ${event.externalId}: o novo email já é de outro User, só o nome foi espelhado`,
      )
    }
    return { data: { received: true } }
  }
}
