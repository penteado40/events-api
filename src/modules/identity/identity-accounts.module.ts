import { Module } from '@nestjs/common'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { ActivationTokenGenerator } from './application/ports/activation-token-generator.js'
import { UserAccounts } from './application/user-accounts.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'
import { CryptoActivationTokenGenerator } from './infrastructure/crypto-activation-token-generator.js'

/**
 * The writes on Users that identity offers other contexts (adding an Event
 * member by email, a Pending user's Activation link). Static and without
 * controllers, like IdentityQueriesModule, and it exports only UserAccounts.
 */
@Module({
  imports: [IdentityPersistenceModule],
  providers: [
    { provide: ActivationTokenGenerator, useClass: CryptoActivationTokenGenerator },
    {
      provide: UserAccounts,
      useFactory: (
        users: UserRepository,
        links: ActivationLinkRepository,
        tokens: ActivationTokenGenerator,
        config: AppConfig,
      ) => new UserAccounts(users, links, tokens, { ttlSeconds: config.activationLinkTtlSeconds }),
      inject: [UserRepository, ActivationLinkRepository, ActivationTokenGenerator, AppConfig],
    },
  ],
  exports: [UserAccounts],
})
export class IdentityAccountsModule {}
