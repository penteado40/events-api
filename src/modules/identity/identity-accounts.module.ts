import { Module } from '@nestjs/common'
import { ActivationLinks } from './application/activation-links.js'
import { UserAccounts } from './application/user-accounts.js'
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
      useFactory: (users: UserRepository, activationLinks: ActivationLinks) =>
        new UserAccounts(users, activationLinks),
      inject: [UserRepository, ActivationLinks],
    },
  ],
  exports: [UserAccounts],
})
export class IdentityAccountsModule {}
