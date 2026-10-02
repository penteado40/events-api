import type { INestApplication } from '@nestjs/common'
import type { Express, NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import { API_TOKEN_HEADER } from './api-token.js'
import type { AllowedOrigins } from './allowed-origins.js'

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export interface SecurityOptions {
  /** Any localhost port is accepted outside production, for local development. */
  allowLocalhostCors: boolean
  allowedOrigins: AllowedOrigins
}

/**
 * Helmet defaults with a strict CSP on every response (the docs route relaxes
 * its own), and CORS for the allowed origins. An unknown origin gets no CORS
 * headers, but its request is still answered: CORS only guards the browser.
 */
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
  // Every response depends on the Origin, refused ones included: the cors
  // package skips them entirely, so a cache could serve them to an allowed one.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.vary('Origin')
    next()
  })
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (origin === undefined) return callback(null, false)
      if (options.allowLocalhostCors && LOCALHOST_ORIGIN.test(origin)) return callback(null, true)
      // A failed check refuses the origin; it must never fail the request itself.
      options.allowedOrigins.isAllowed(origin).then(
        (allowed) => callback(null, allowed),
        () => callback(null, false),
      )
    },
    // Credentials travel in headers only, never cookies: no `credentials`.
    allowedHeaders: ['Authorization', API_TOKEN_HEADER, 'Content-Type'],
    maxAge: 600,
  })
}
