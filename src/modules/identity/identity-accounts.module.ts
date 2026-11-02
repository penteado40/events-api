import { Module } from '@nestjs/common'
import { ActivationLinkMailer } from './application/ports/activation-link-mailer.js'
import { InvitationIssuer } from './application/ports/invitation-issuer.js'
import { UserAccounts } from './application/user-accounts.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityInvitationsModule } from './identity-invitations.module.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'

/**
 * The writes on Users that identity offers other contexts (a User ensured by
 * email, a Pending user's Activation link). Static and without controllers,
 * like IdentityQueriesModule, and it exports only UserAccounts.
 */
@Module({
  imports: [IdentityPersistenceModule, IdentityInvitationsModule],
  providers: [
    {
      provide: UserAccounts,
      useFactory: (
        users: UserRepository,
        links: ActivationLinkRepository,
        invitations: InvitationIssuer,
        mailer: ActivationLinkMailer,
      ) => new UserAccounts(users, links, invitations, mailer),
      inject: [UserRepository, ActivationLinkRepository, InvitationIssuer, ActivationLinkMailer],
    },
  ],
  exports: [UserAccounts],
})
export class IdentityAccountsModule {}
