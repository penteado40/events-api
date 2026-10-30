import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AppConfig } from './shared/infrastructure/app-config.js'
import { AllowedOrigins } from './shared/presentation/allowed-origins.js'
import { API_PREFIX } from './shared/presentation/api-prefix.js'
import { setupDocs } from './shared/presentation/docs.js'
import { applySecurity } from './shared/presentation/security.js'

/** HTTP-level setup shared by main.ts, the Vercel entry and the integration tests. */
export function configureApp(app: INestApplication, config: AppConfig): INestApplication {
  // Vercel's edge overwrites x-forwarded-for, so there it is the client IP
  // (the rate limit keys on it). Elsewhere, the socket address.
  if (config.behindVercelProxy) (app as NestExpressApplication).set('trust proxy', true)
  applySecurity(app, {
    allowLocalhostCors: !config.isProduction,
    allowedOrigins: app.get(AllowedOrigins),
  })
  app.setGlobalPrefix(API_PREFIX)
  if (config.docsEnabled) setupDocs(app)
  return app
}
