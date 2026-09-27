import { type DynamicModule, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { PasswordHasher } from './application/ports/password-hasher.js'
import { TokenIssuer } from './application/ports/token-issuer.js'
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case.js'
import { LoginUseCase } from './application/use-cases/login.use-case.js'
import { UserRepository } from './domain/user.repository.js'
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher.js'
import { JwtTokenIssuer, TOKEN_TTL_SECONDS } from './infrastructure/jwt-token-issuer.js'
import { JwtStrategy } from './infrastructure/jwt.strategy.js'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js'
import { AuthController } from './presentation/auth.controller.js'
import { MeController } from './presentation/me.controller.js'
import { TokenController } from './presentation/token.controller.js'

export interface IdentityModuleOptions {
  /** Registers POST /auth/token (Scalar login) alongside the docs. */
  docsEnabled: boolean
}

/** Composition root of the identity context: Users, login, password. */
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
            signOptions: { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS },
            verifyOptions: { algorithms: ['HS256'] },
          }),
        }),
      ],
      controllers: [
        AuthController,
        MeController,
        ...(options.docsEnabled ? [TokenController] : []),
      ],
      providers: [
        { provide: UserRepository, useClass: PrismaUserRepository },
        { provide: PasswordHasher, useClass: BcryptPasswordHasher },
        { provide: TokenIssuer, useClass: JwtTokenIssuer },
        {
          provide: LoginUseCase,
          useFactory: (users: UserRepository, hasher: PasswordHasher, tokens: TokenIssuer) =>
            new LoginUseCase(users, hasher, tokens),
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
