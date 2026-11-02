import { Module } from '@nestjs/common'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { EmailsModule } from '../emails/index.js'
import { ActivationLinkMailer } from './application/ports/activation-link-mailer.js'
import { InvitationIssuer } from './application/ports/invitation-issuer.js'
import { ClerkInvitationIssuer } from './infrastructure/clerk-invitation-issuer.js'
import { InProcessActivationLinkMailer } from './infrastructure/in-process-activation-link-mailer.js'

/**
 * The one place that binds what issues and delivers an Activation link (the
 * InvitationIssuer to Clerk, the ActivationLinkMailer to the emails context),
 * so the composition root and IdentityAccountsModule share them and tests
 * override them once. Internal to identity, like IdentityPersistenceModule.
 */
@Module({
  imports: [EmailsModule],
  providers: [
    { provide: ActivationLinkMailer, useClass: InProcessActivationLinkMailer },
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
  exports: [InvitationIssuer, ActivationLinkMailer],
})
export class IdentityInvitationsModule {}
