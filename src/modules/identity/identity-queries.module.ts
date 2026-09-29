import { Module } from '@nestjs/common'
import { UserLookup } from './application/user-lookup.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'

/**
 * The read-only queries identity offers other contexts. Static and without
 * controllers, so a context imports it explicitly and the dependency shows.
 * It uses the UserRepository but does not re-export it: importers see only
 * the queries, never a way to write Users.
 */
@Module({
  imports: [IdentityPersistenceModule],
  providers: [
    {
      provide: UserLookup,
      useFactory: (users: UserRepository) => new UserLookup(users),
      inject: [UserRepository],
    },
  ],
  exports: [UserLookup],
})
export class IdentityQueriesModule {}
