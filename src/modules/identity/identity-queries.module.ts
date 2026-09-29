import { Module } from '@nestjs/common'
import { UserLookup } from './application/user-lookup.js'
import { UserRepository } from './domain/user.repository.js'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js'

/**
 * The read-only queries identity offers other contexts. Static and without
 * controllers, so a context imports it explicitly and the dependency shows.
 */
@Module({
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    {
      provide: UserLookup,
      useFactory: (users: UserRepository) => new UserLookup(users),
      inject: [UserRepository],
    },
  ],
  exports: [UserLookup],
})
export class IdentityQueriesModule {}
