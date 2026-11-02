import type { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test, type TestingModuleBuilder } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { AuthVerifier } from '../../../src/modules/identity/application/ports/auth-verifier.js'
import { InvitationIssuer } from '../../../src/modules/identity/application/ports/invitation-issuer.js'
import { FakeAuthVerifier } from '../../../src/modules/identity/application/testing/fake-auth-verifier.js'
import { FakeInvitationIssuer } from '../../../src/modules/identity/application/testing/fake-invitation-issuer.js'
import { configureApp } from '../../../src/app.setup.js'
import { Clock } from '../../../src/shared/application/clock.js'
import { RateLimitStore } from '../../../src/shared/application/rate-limit-store.js'
import { InMemoryRateLimitStore } from '../../../src/shared/application/testing/in-memory-rate-limit-store.js'
import { AppConfig } from '../../../src/shared/infrastructure/app-config.js'
import { SystemClock } from '../../../src/shared/infrastructure/system-clock.js'
import { loadTestEnv } from './env.js'

/** Signs the Clerk webhooks of the tests (see `clerkWebhook`), verified by the real Svix adapter. */
export const TEST_WEBHOOK_SIGNING_SECRET = `whsec_${Buffer.from('integration-test-webhook-secret!').toString('base64')}`

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
  /** The Clerk invitations the app issued: Activation links, never a call to Clerk. */
  invitations: FakeInvitationIssuer
  close: () => Promise<void>
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const { databaseUrl } = loadTestEnv()
  const config = AppConfig.fromEnv({
    ...process.env,
    NODE_ENV: 'test',
    DOCS_ENABLED: 'false',
    CLERK_WEBHOOK_SIGNING_SECRET: TEST_WEBHOOK_SIGNING_SECRET,
    ...options.env,
    DATABASE_URL: databaseUrl,
  })

  const invitations = new FakeInvitationIssuer(new SystemClock(), config.activationLinkTtlDays)
  let builder = Test.createTestingModule({
    imports: [AppModule.forRoot(config), ...(options.imports ?? [])],
    controllers: options.controllers ?? [],
  })
    // Rate-limit counters in memory, never the Upstash the env may point to.
    .overrideProvider(RateLimitStore)
    .useFactory({ factory: (clock: Clock) => new InMemoryRateLimitStore(clock), inject: [Clock] })
    // Session tokens built by sessionTokenFor, never a call to Clerk.
    .overrideProvider(AuthVerifier)
    .useValue(new FakeAuthVerifier())
    .overrideProvider(InvitationIssuer)
    .useValue(invitations)
  if (options.override) builder = options.override(builder)
  const moduleRef = await builder.compile()

  const app = moduleRef.createNestApplication({ logger: false, rawBody: true })
  configureApp(app, config)
  await app.init()

  return {
    app,
    config,
    invitations,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  }
}
