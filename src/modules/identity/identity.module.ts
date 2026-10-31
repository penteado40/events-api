import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Clock } from '../../shared/application/clock.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { AuthVerifier } from './application/ports/auth-verifier.js'
import { ActivationTokenGenerator } from './application/ports/activation-token-generator.js'
import { Memberships } from './application/ports/memberships.js'
import { AuthenticateUseCase } from './application/use-cases/authenticate.use-case.js'
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js'
import { GetMeUseCase } from './application/use-cases/get-me.use-case.js'
import { IssueActivationLinkUseCase } from './application/use-cases/issue-activation-link.use-case.js'
import { UpdateMeUseCase } from './application/use-cases/update-me.use-case.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'
import { ClerkAuthVerifier } from './infrastructure/clerk-auth-verifier.js'
import { CryptoActivationTokenGenerator } from './infrastructure/crypto-activation-token-generator.js'
import { NoGroupsMemberships } from './infrastructure/no-groups-memberships.js'
import { CredentialsGuard } from './presentation/credentials.guard.js'
import { MeController } from './presentation/me.controller.js'
import { UsersController } from './presentation/users.controller.js'

/**
 * Composition root of the identity context: Users, their Activation links, and
 * the global guard that authenticates every request by the Clerk token.
 */
@Module({
  imports: [IdentityPersistenceModule],
  controllers: [MeController, UsersController],
  providers: [
    { provide: ActivationTokenGenerator, useClass: CryptoActivationTokenGenerator },
    { provide: Memberships, useClass: NoGroupsMemberships },
    {
      provide: AuthVerifier,
      useFactory: (config: AppConfig) =>
        new ClerkAuthVerifier({
          secretKey: config.clerkSecretKey,
          jwtKey: config.clerkJwtKey,
          authorizedParties: config.clerkAuthorizedParties,
        }),
      inject: [AppConfig],
    },
    {
      provide: CreateUserUseCase,
      useFactory: (
        users: UserRepository,
        links: ActivationLinkRepository,
        tokens: ActivationTokenGenerator,
        clock: Clock,
        config: AppConfig,
      ) =>
        new CreateUserUseCase(users, links, tokens, clock, {
          ttlSeconds: config.activationLinkTtlSeconds,
        }),
      inject: [
        UserRepository,
        ActivationLinkRepository,
        ActivationTokenGenerator,
        Clock,
        AppConfig,
      ],
    },
    {
      provide: IssueActivationLinkUseCase,
      useFactory: (
        users: UserRepository,
        links: ActivationLinkRepository,
        tokens: ActivationTokenGenerator,
        clock: Clock,
        config: AppConfig,
      ) =>
        new IssueActivationLinkUseCase(users, links, tokens, clock, {
          ttlSeconds: config.activationLinkTtlSeconds,
        }),
      inject: [
        UserRepository,
        ActivationLinkRepository,
        ActivationTokenGenerator,
        Clock,
        AppConfig,
      ],
    },
    {
      provide: GetMeUseCase,
      useFactory: (memberships: Memberships) => new GetMeUseCase(memberships),
      inject: [Memberships],
    },
    {
      provide: UpdateMeUseCase,
      useFactory: (users: UserRepository, clock: Clock) => new UpdateMeUseCase(users, clock),
      inject: [UserRepository, Clock],
    },
    {
      provide: AuthenticateUseCase,
      useFactory: (users: UserRepository, verifier: AuthVerifier, clock: Clock) =>
        new AuthenticateUseCase(users, verifier, clock),
      inject: [UserRepository, AuthVerifier, Clock],
    },
    { provide: APP_GUARD, useClass: CredentialsGuard },
  ],
})
export class IdentityModule {}
