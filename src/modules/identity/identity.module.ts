import { type DynamicModule, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { Clock } from '../../shared/application/clock.js'
import { RateLimiter } from '../../shared/application/rate-limiter.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { AuthVerifier } from './application/ports/auth-verifier.js'
import { ActivationTokenGenerator } from './application/ports/activation-token-generator.js'
import { PasswordHasher } from './application/ports/password-hasher.js'
import { TokenIssuer } from './application/ports/token-issuer.js'
import { ActivateUserUseCase } from './application/use-cases/activate-user.use-case.js'
import { AuthenticateUseCase } from './application/use-cases/authenticate.use-case.js'
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case.js'
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js'
import { IssueActivationLinkUseCase } from './application/use-cases/issue-activation-link.use-case.js'
import { LoginUseCase } from './application/use-cases/login.use-case.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'
import { ClerkAuthVerifier } from './infrastructure/clerk-auth-verifier.js'
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher.js'
import { CryptoActivationTokenGenerator } from './infrastructure/crypto-activation-token-generator.js'
import {
  JWT_ALGORITHM,
  JwtTokenIssuer,
  TOKEN_TTL_SECONDS,
} from './infrastructure/jwt-token-issuer.js'
import { AuthController } from './presentation/auth.controller.js'
import { CredentialsGuard } from './presentation/credentials.guard.js'
import { MeController } from './presentation/me.controller.js'
import { TokenController } from './presentation/token.controller.js'
import { UsersController } from './presentation/users.controller.js'

export interface IdentityModuleOptions {
  /** Registers POST /auth/token (Scalar login) alongside the docs. */
  docsEnabled: boolean
}

/**
 * Composition root of the identity context: Users, activation, login, password,
 * and the global guard that authenticates every request by the Clerk token.
 */
@Module({})
export class IdentityModule {
  static register(options: IdentityModuleOptions): DynamicModule {
    return {
      module: IdentityModule,
      imports: [
        IdentityPersistenceModule,
        JwtModule.registerAsync({
          inject: [AppConfig],
          useFactory: (config: AppConfig) => ({
            secret: config.jwtSecret,
            signOptions: { algorithm: JWT_ALGORITHM, expiresIn: TOKEN_TTL_SECONDS },
            verifyOptions: { algorithms: [JWT_ALGORITHM] },
          }),
        }),
      ],
      controllers: [
        AuthController,
        MeController,
        UsersController,
        ...(options.docsEnabled ? [TokenController] : []),
      ],
      providers: [
        { provide: PasswordHasher, useClass: BcryptPasswordHasher },
        { provide: TokenIssuer, useClass: JwtTokenIssuer },
        { provide: ActivationTokenGenerator, useClass: CryptoActivationTokenGenerator },
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
          provide: LoginUseCase,
          useFactory: (
            users: UserRepository,
            hasher: PasswordHasher,
            tokens: TokenIssuer,
            limiter: RateLimiter,
          ) => new LoginUseCase(users, hasher, tokens, limiter),
          inject: [UserRepository, PasswordHasher, TokenIssuer, RateLimiter],
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
          provide: ActivateUserUseCase,
          useFactory: (
            users: UserRepository,
            links: ActivationLinkRepository,
            tokens: ActivationTokenGenerator,
            hasher: PasswordHasher,
            sessions: TokenIssuer,
            clock: Clock,
          ) => new ActivateUserUseCase(users, links, tokens, hasher, sessions, clock),
          inject: [
            UserRepository,
            ActivationLinkRepository,
            ActivationTokenGenerator,
            PasswordHasher,
            TokenIssuer,
            Clock,
          ],
        },
        {
          provide: ChangePasswordUseCase,
          useFactory: (
            users: UserRepository,
            hasher: PasswordHasher,
            sessions: TokenIssuer,
            clock: Clock,
          ) => new ChangePasswordUseCase(users, hasher, sessions, clock),
          inject: [UserRepository, PasswordHasher, TokenIssuer, Clock],
        },
        {
          provide: AuthenticateUseCase,
          useFactory: (users: UserRepository, verifier: AuthVerifier, clock: Clock) =>
            new AuthenticateUseCase(users, verifier, clock),
          inject: [UserRepository, AuthVerifier, Clock],
        },
        { provide: APP_GUARD, useClass: CredentialsGuard },
      ],
    }
  }
}
