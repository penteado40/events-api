import { type DynamicModule, Global, Logger, Module } from '@nestjs/common'
import { BackgroundTasks } from '../application/background-tasks.js'
import { Clock } from '../application/clock.js'
import { EventPublisher } from '../application/ports/event-publisher.js'
import { RateLimitStore } from '../application/rate-limit-store.js'
import { RateLimiter } from '../application/rate-limiter.js'
import { SecretTokens } from '../application/secret-tokens.js'
import { UnitOfWork } from '../application/unit-of-work.js'
import { InMemoryRateLimitStore } from '../application/testing/in-memory-rate-limit-store.js'
import { AppConfig } from './app-config.js'
import { CryptoSecretTokens } from './crypto-secret-tokens.js'
import { InProcessEventPublisher } from './in-process-event-publisher.js'
import { PrismaService } from './prisma.service.js'
import { PrismaUnitOfWork } from './prisma-unit-of-work.js'
import { SystemClock } from './system-clock.js'
import { UpstashRateLimitStore } from './upstash-rate-limit-store.js'
import { VercelBackgroundTasks } from './vercel-background-tasks.js'

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
        {
          provide: PrismaUnitOfWork,
          useFactory: (prisma: PrismaService) => new PrismaUnitOfWork(prisma),
          inject: [PrismaService],
        },
        { provide: UnitOfWork, useExisting: PrismaUnitOfWork },
        { provide: Clock, useClass: SystemClock },
        { provide: BackgroundTasks, useClass: VercelBackgroundTasks },
        {
          provide: InProcessEventPublisher,
          useFactory: (tasks: BackgroundTasks) => {
            const logger = new Logger('EventPublisher')
            return new InProcessEventPublisher(tasks, (error, event) =>
              logger.error(
                `Handler de ${event.type} falhou: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
              ),
            )
          },
          inject: [BackgroundTasks],
        },
        { provide: EventPublisher, useExisting: InProcessEventPublisher },
        { provide: SecretTokens, useClass: CryptoSecretTokens },
        {
          provide: RateLimitStore,
          useFactory: (c: AppConfig, clock: Clock) =>
            c.upstash
              ? new UpstashRateLimitStore({ ...c.upstash, prefix: c.rateLimitPrefix })
              : new InMemoryRateLimitStore(clock),
          inject: [AppConfig, Clock],
        },
        {
          provide: RateLimiter,
          useFactory: (store: RateLimitStore, clock: Clock) => {
            const logger = new Logger('RateLimiter')
            return new RateLimiter(store, clock, {
              onStoreError: (error) =>
                logger.error(
                  `Store do rate limit falhou; deixando passar: ${error instanceof Error ? error.message : String(error)}`,
                ),
            })
          },
          inject: [RateLimitStore, Clock],
        },
      ],
      exports: [
        AppConfig,
        PrismaService,
        PrismaUnitOfWork,
        UnitOfWork,
        Clock,
        BackgroundTasks,
        EventPublisher,
        InProcessEventPublisher,
        SecretTokens,
        RateLimiter,
      ],
    }
  }
}
