import { type DynamicModule, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { ActivationTokenGenerator } from './application/ports/activation-token-generator.js'
import { PasswordHasher } from './application/ports/password-hasher.js'
import { TokenIssuer } from './application/ports/token-issuer.js'
import { ActivateUserUseCase } from './application/use-cases/activate-user.use-case.js'
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case.js'
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js'
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case.js'
import { IssueActivationLinkUseCase } from './application/use-cases/issue-activation-link.use-case.js'
import { LoginUseCase } from './application/use-cases/login.use-case.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher.js'
import { CryptoActivationTokenGenerator } from './infrastructure/crypto-activation-token-generator.js'
import {
  JWT_ALGORITHM,
  JwtTokenIssuer,
  TOKEN_TTL_SECONDS,
} from './infrastructure/jwt-token-issuer.js'
import { JwtStrategy } from './infrastructure/jwt.strategy.js'
import { PrismaActivationLinkRepository } from './infrastructure/prisma-activation-link.repository.js'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js'
import { AuthController } from './presentation/auth.controller.js'
import { MeController } from './presentation/me.controller.js'
import { TokenController } from './presentation/token.controller.js'
import { UsersController } from './presentation/users.controller.js'

export interface IdentityModuleOptions {
  /** Registers POST /auth/token (Scalar login) alongside the docs. */
  docsEnabled: boolean
}

/** Composition root of the identity context: Users, activation, login, password. */
@Module({})
export class IdentityModule {
  static register(options: IdentityModuleOptions): DynamicModule {
    return {
      module: IdentityModule,
      imports: [
        PassportModule,
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
        { provide: UserRepository, useClass: PrismaUserRepository },
        { provide: PasswordHasher, useClass: BcryptPasswordHasher },
        { provide: TokenIssuer, useClass: JwtTokenIssuer },
        { provide: ActivationLinkRepository, useClass: PrismaActivationLinkRepository },
        { provide: ActivationTokenGenerator, useClass: CryptoActivationTokenGenerator },
        {
          provide: LoginUseCase,
          useFactory: (users: UserRepository, hasher: PasswordHasher, tokens: TokenIssuer) =>
            new LoginUseCase(users, hasher, tokens),
          inject: [UserRepository, PasswordHasher, TokenIssuer],
        },
        {
          provide: CreateUserUseCase,
          useFactory: (
            users: UserRepository,
            links: ActivationLinkRepository,
            tokens: ActivationTokenGenerator,
            config: AppConfig,
          ) =>
            new CreateUserUseCase(users, links, tokens, {
              ttlSeconds: config.activationLinkTtlSeconds,
            }),
          inject: [UserRepository, ActivationLinkRepository, ActivationTokenGenerator, AppConfig],
        },
        {
          provide: IssueActivationLinkUseCase,
          useFactory: (
            users: UserRepository,
            links: ActivationLinkRepository,
            tokens: ActivationTokenGenerator,
            config: AppConfig,
          ) =>
            new IssueActivationLinkUseCase(users, links, tokens, {
              ttlSeconds: config.activationLinkTtlSeconds,
            }),
          inject: [UserRepository, ActivationLinkRepository, ActivationTokenGenerator, AppConfig],
        },
        {
          provide: ActivateUserUseCase,
          useFactory: (
            users: UserRepository,
            links: ActivationLinkRepository,
            tokens: ActivationTokenGenerator,
            hasher: PasswordHasher,
            sessions: TokenIssuer,
          ) => new ActivateUserUseCase(users, links, tokens, hasher, sessions),
          inject: [
            UserRepository,
            ActivationLinkRepository,
            ActivationTokenGenerator,
            PasswordHasher,
            TokenIssuer,
          ],
        },
        {
          provide: ChangePasswordUseCase,
          useFactory: (users: UserRepository, hasher: PasswordHasher, sessions: TokenIssuer) =>
            new ChangePasswordUseCase(users, hasher, sessions),
          inject: [UserRepository, PasswordHasher, TokenIssuer],
        },
        {
          provide: GetCurrentUserUseCase,
          useFactory: (users: UserRepository) => new GetCurrentUserUseCase(users),
          inject: [UserRepository],
        },
        JwtStrategy,
      ],
    }
  }
}
