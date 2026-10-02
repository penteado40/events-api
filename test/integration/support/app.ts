import type { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test, type TestingModuleBuilder } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { configureApp } from '../../../src/app.setup.js'
import { Clock } from '../../../src/shared/application/clock.js'
import { RateLimitStore } from '../../../src/shared/application/rate-limit-store.js'
import { InMemoryRateLimitStore } from '../../../src/shared/application/testing/in-memory-rate-limit-store.js'
import { AppConfig } from '../../../src/shared/infrastructure/app-config.js'
import { loadTestEnv } from './env.js'

export interface TestAppOptions {
  env?: Record<string, string>
  /** Extra modules/controllers, e.g. a test-only route. */
  imports?: ModuleMetadata['imports']
  controllers?: ModuleMetadata['controllers']
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder
}

export interface TestApp {
  app: INestApplication
  http: () => ReturnType<typeof request>
  config: AppConfig
  close: () => Promise<void>
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const { databaseUrl } = loadTestEnv()
  const config = AppConfig.fromEnv({
    ...process.env,
    NODE_ENV: 'test',
    DOCS_ENABLED: 'false',
    ...options.env,
    DATABASE_URL: databaseUrl,
  })

  let builder = Test.createTestingModule({
    imports: [AppModule.forRoot(config), ...(options.imports ?? [])],
    controllers: options.controllers ?? [],
  })
    // Rate-limit counters in memory, never the Upstash the env may point to.
    .overrideProvider(RateLimitStore)
    .useFactory({ factory: (clock: Clock) => new InMemoryRateLimitStore(clock), inject: [Clock] })
  if (options.override) builder = options.override(builder)
  const moduleRef = await builder.compile()

  const app = moduleRef.createNestApplication({ logger: false })
  configureApp(app, config)
  await app.init()

  return {
    app,
    config,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  }
}
