import { randomBytes } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import type { Request, Response } from 'express'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { API_PREFIX } from './api-prefix.js'

export const DOCS_PATH = `/${API_PREFIX}/docs`
export const OPENAPI_PATH = `/${API_PREFIX}/openapi`
export const TOKEN_PATH = `/${API_PREFIX}/auth/token`

const SCALAR_CDN = 'https://cdn.jsdelivr.net'

/**
 * Registers Scalar and the OpenAPI document. Only called with DOCS_ENABLED=true,
 * so both routes 404 otherwise.
 */
export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('events-api')
    .setDescription('API multi-evento: RSVP, lista de presentes e emails para convidados.')
    .setVersion('v1')
    .addBearerAuth()
    .addOAuth2(
      { type: 'oauth2', flows: { password: { tokenUrl: TOKEN_PATH, scopes: {} } } },
      'oauth2',
    )
    .build()
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config))

  const http = app.getHttpAdapter()
  http.get(OPENAPI_PATH, (_req: Request, res: Response) => res.json(document))
  http.get(DOCS_PATH, (req: Request, res: Response) => {
    const nonce = randomBytes(16).toString('base64')
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' ${SCALAR_CDN}`,
        `style-src 'self' 'unsafe-inline' ${SCALAR_CDN}`,
        `font-src 'self' data: ${SCALAR_CDN} https://fonts.scalar.com`,
        `img-src 'self' data: ${SCALAR_CDN}`,
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    )
    const render = apiReference({
      url: OPENAPI_PATH,
      nonce,
      authentication: { preferredSecurityScheme: 'oauth2' },
    })
    render(req, res)
  })
}
