import { Module } from '@nestjs/common'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { InvitationIssuer } from './application/ports/invitation-issuer.js'
import { ClerkInvitationIssuer } from './infrastructure/clerk-invitation-issuer.js'

/**
 * The one place that binds the InvitationIssuer to Clerk, so the composition
 * root and IdentityAccountsModule share it and tests override it once.
 * Internal to identity, like IdentityPersistenceModule.
 */
@Module({
  providers: [
    {
      provide: InvitationIssuer,
      useFactory: (config: AppConfig) =>
        new ClerkInvitationIssuer({
          secretKey: config.clerkSecretKey,
          redirectUrl: config.activationRedirectUrl,
          ttlDays: config.activationLinkTtlDays,
        }),
      inject: [AppConfig],
    },
  ],
  exports: [InvitationIssuer],
})
export class IdentityInvitationsModule {}
