import type { INestApplication } from '@nestjs/common'
import type { Express } from 'express'
import helmet from 'helmet'

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export interface SecurityOptions {
  /** CORS stays closed until PROJ-58; only localhost is allowed outside production. */
  allowLocalhostCors: boolean
}

/** Helmet defaults with a strict CSP on every response (the docs route relaxes its own). */
export function applySecurity(app: INestApplication, options: SecurityOptions): void {
  const express = app.getHttpAdapter().getInstance() as Express
  express.disable('x-powered-by')
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
    }),
  )
  if (options.allowLocalhostCors) app.enableCors({ origin: LOCALHOST_ORIGIN })
}
