import { type DynamicModule, Global, Module } from '@nestjs/common'
import { Clock } from '../application/clock.js'
import { SecretTokens } from '../application/secret-tokens.js'
import { AppConfig } from './app-config.js'
import { CryptoSecretTokens } from './crypto-secret-tokens.js'
import { PrismaService } from './prisma.service.js'
import { SystemClock } from './system-clock.js'

@Global()
@Module({})
export class SharedModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: SharedModule,
      providers: [
        { provide: AppConfig, useValue: config },
        {
          provide: PrismaService,
          useFactory: (c: AppConfig) => new PrismaService(c.databaseUrl),
          inject: [AppConfig],
        },
        { provide: Clock, useClass: SystemClock },
        { provide: SecretTokens, useClass: CryptoSecretTokens },
      ],
      exports: [AppConfig, PrismaService, Clock, SecretTokens],
    }
  }
}
