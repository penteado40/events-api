import type { INestApplication } from '@nestjs/common'
import type { Express, NextFunction, Request, Response } from 'express'
import helmet from 'helmet'

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export interface SecurityOptions {
  /** Any localhost port is accepted outside production, for local development. */
  allowLocalhostCors: boolean
  /** The origins listed in `CORS_ORIGINS` (e.g. the Panel), and only them. */
  allowedOrigins: readonly string[]
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
  const allowedOrigins = new Set(options.allowedOrigins)
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (origin === undefined) return callback(null, false)
      if (options.allowLocalhostCors && LOCALHOST_ORIGIN.test(origin)) return callback(null, true)
      callback(null, allowedOrigins.has(origin))
    },
    // Credentials travel in headers only, never cookies: no `credentials`.
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  })
}
