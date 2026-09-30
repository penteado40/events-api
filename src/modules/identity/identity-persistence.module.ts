import { Module } from '@nestjs/common'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { PrismaActivationLinkRepository } from './infrastructure/prisma-activation-link.repository.js'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js'

/**
 * The one place that binds identity's repositories to their adapters. Internal
 * to identity: not in index.ts, so no other context can import it and write Users.
 */
@Module({
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: ActivationLinkRepository, useClass: PrismaActivationLinkRepository },
  ],
  exports: [UserRepository, ActivationLinkRepository],
})
export class IdentityPersistenceModule {}
