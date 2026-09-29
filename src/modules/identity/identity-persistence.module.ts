import { Module } from '@nestjs/common'
import { UserRepository } from './domain/user.repository.js'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js'

/**
 * The one place that binds identity's repository to its adapter. Internal to
 * identity: not in index.ts, so no other context can import it and write Users.
 */
@Module({
  providers: [{ provide: UserRepository, useClass: PrismaUserRepository }],
  exports: [UserRepository],
})
export class IdentityPersistenceModule {}
