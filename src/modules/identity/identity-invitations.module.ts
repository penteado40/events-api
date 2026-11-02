import { Module } from '@nestjs/common'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { ActivationLinks } from './application/activation-links.js'
import { InvitationIssuer } from './application/ports/invitation-issuer.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'
import { ClerkInvitationIssuer } from './infrastructure/clerk-invitation-issuer.js'

/**
 * The one place that binds the InvitationIssuer to Clerk and builds the
 * ActivationLinks on top of it, so the composition root and
 * IdentityAccountsModule share them and tests override the issuer once.
 * Internal to identity, like IdentityPersistenceModule.
 */
@Module({
  imports: [IdentityPersistenceModule],
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
    {
      provide: ActivationLinks,
      useFactory: (
        users: UserRepository,
        links: ActivationLinkRepository,
        invitations: InvitationIssuer,
      ) => new ActivationLinks(users, links, invitations),
      inject: [UserRepository, ActivationLinkRepository, InvitationIssuer],
    },
  ],
  exports: [ActivationLinks],
})
export class IdentityInvitationsModule {}
