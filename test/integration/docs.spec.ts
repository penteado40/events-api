import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { registeredRoutes } from './support/routes.js'

describe('docs with DOCS_ENABLED=true', () => {
  let t: TestApp

  beforeAll(async () => {
    // Blank even when the developer's .env sets it: this is the docs without the Clerk login.
    t = await createTestApp({ env: { DOCS_ENABLED: 'true', CLERK_PUBLISHABLE_KEY: '' } })
  })

  afterAll(() => t.close())

  it('serves the OpenAPI document with the Bearer token as its only security scheme', async () => {
    const res = await t.http().get('/api/v1/openapi')

    expect(res.status).toBe(200)
    expect(res.body.openapi).toMatch(/^3\./)
    expect(Object.keys(res.body.components.securitySchemes)).toEqual(['bearer'])
  })

  // The docs are the manual test interface of the API, so they are a tested
  // contract (ADR-0009): these fail when a new route skips them.
  describe('every route of the API is documented', () => {
    let doc: OpenAPIObject

    beforeAll(async () => {
      doc = (await t.http().get('/api/v1/openapi')).body
    })

    it('lists every registered route', () => {
      const registered = registeredRoutes(t)
      const documented = operationsOf(doc).map(({ key }) => key)
      const undocumented = registered.filter(
        (key) => !documented.includes(key) && !UNDOCUMENTED_ROUTES.includes(key),
      )

      expect(registered).toContain('GET /api/v1/me')
      expect(undocumented).toEqual([])
    })

    it('gives every operation a summary', () => {
      const missing = operationsOf(doc)
        .filter(({ operation }) => !operation.summary?.trim())
        .map(({ key }) => key)

      expect(missing).toEqual([])
    })

    // 401 and 400 are added on their own, so only an explicit @ApiErrors(...),
    // even an empty one, shows the business errors were thought through.
    it('declares the business errors of every operation with @ApiErrors', () => {
      const missing = operationsOf(doc)
        .filter(
          ({ operation }) =>
            !Array.isArray((operation as unknown as Record<string, unknown>)['x-error-codes']),
        )
        .map(({ key }) => key)

      expect(missing).toEqual([])
    })

    it('shows the protected routes with a lock and the public ones without', () => {
      expect(doc.security).toEqual([{ bearer: [] }])
      const publicOnes = operationsOf(doc)
        .filter(({ operation }) => operation.security?.length === 0)
        .map(({ key }) => key)

      expect(publicOnes).toEqual([])
    })

    it('documents the Membership and the Super admin flag of the me, with an example', () => {
      for (const method of ['get', 'patch'] as const) {
        const operation = (doc.paths['/api/v1/me'] as Record<string, OperationObject>)[method]!
        const response = operation.responses['200'] as ResponseObject
        const body = resolve(doc, response.content!['application/json']!.schema!)
        const data = resolve(doc, body.properties!['data']!)

        expect(data.properties!['isSuperAdmin']).toMatchObject({ type: 'boolean', example: false })
        expect(data.properties!['memberships']).toMatchObject({
          type: 'array',
          example: [{ groupId: 1, groupName: 'Vocal Livre', role: 'OWNER' }],
        })
      }
    })

    it('gives every field of a request body an example', () => {
      const missing = operationsOf(doc).flatMap(({ key, operation }) => {
        const body = operation.requestBody as RequestBodyObject | undefined
        const schema = body?.content['application/json']?.schema
        return schema ? fieldsWithoutExample(doc, schema, key) : []
      })

      expect(missing).toEqual([])
    })
  })

  it('serves Scalar with a CSP relaxed only for its CDN', async () => {
    const res = await t.http().get('/api/v1/docs')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('/api/v1/openapi')
    const csp = res.headers['content-security-policy']
    expect(csp).toContain("default-src 'none'")
    expect(csp).toMatch(/script-src 'nonce-[^']+' https:\/\/cdn\.jsdelivr\.net/)
    expect(csp).not.toContain("script-src 'unsafe-inline'")
  })

  it('serves Scalar without the Clerk login when CLERK_PUBLISHABLE_KEY is unset', async () => {
    const res = await t.http().get('/api/v1/docs')

    expect(res.text).toContain('Scalar.createApiReference')
    expect(res.text).not.toMatch(/clerk/i)
    expect(res.headers['content-security-policy']).not.toMatch(/clerk/i)
  })
})

describe('docs with DOCS_ENABLED=true and CLERK_PUBLISHABLE_KEY', () => {
  const FRONTEND_API = 'happy-cat-12.clerk.accounts.dev'
  const PUBLISHABLE_KEY = `pk_test_${Buffer.from(`${FRONTEND_API}$`).toString('base64')}`
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({
      env: { DOCS_ENABLED: 'true', CLERK_PUBLISHABLE_KEY: PUBLISHABLE_KEY },
    })
  })

  afterAll(() => t.close())

  it('loads Clerk JS and its UI from the Frontend API of the key, with the nonce', async () => {
    const res = await t.http().get('/api/v1/docs')
    const nonce = /script-src 'nonce-([^']+)'/.exec(
      res.headers['content-security-policy'] as string,
    )![1]!

    expect(res.status).toBe(200)
    for (const bundle of [
      '@clerk/clerk-js@6/dist/clerk.browser.js',
      '@clerk/ui@1/dist/ui.browser.js',
    ]) {
      const tag = new RegExp(`<script[^>]*src="https://${FRONTEND_API}/npm/${bundle}"[^>]*>`).exec(
        res.text,
      )
      expect(tag?.[0], bundle).toContain(`nonce="${nonce}"`)
    }
    expect(res.text).toContain(`data-clerk-publishable-key="${PUBLISHABLE_KEY}"`)
    expect(res.text).toContain('Entrar com Clerk')
    expect(res.text).toContain('onBeforeRequest')
  })

  it('relaxes the CSP for Clerk only where it needs, keeping the nonce', async () => {
    const res = await t.http().get('/api/v1/docs')
    const directives = Object.fromEntries(
      (res.headers['content-security-policy'] as string)
        .split('; ')
        .map((d) => [d.split(' ')[0], d.split(' ').slice(1)]),
    )

    expect(directives['default-src']).toEqual(["'none'"])
    expect(directives['script-src']).toEqual(
      expect.arrayContaining([expect.stringMatching(/^'nonce-/), `https://${FRONTEND_API}`]),
    )
    expect(directives['script-src']).not.toContain("'unsafe-inline'")
    expect(directives['connect-src']).toEqual(
      expect.arrayContaining(["'self'", `https://${FRONTEND_API}`]),
    )
    expect(directives['img-src']).toContain('https://img.clerk.com')
    expect(directives['worker-src']).toEqual(["'self'", 'blob:'])
    expect(directives['frame-src']).toContain('https://challenges.cloudflare.com')
    expect(directives['form-action']).toEqual(["'self'"])
    expect(directives['frame-ancestors']).toEqual(["'none'"])
  })
})

/** Routes left out of the docs on purpose, each with why. */
const UNDOCUMENTED_ROUTES = [
  // The docs themselves.
  'GET /api/v1/docs',
  'GET /api/v1/openapi',
  // Called only by Clerk, signed by Svix: nobody tries it by hand from the docs.
  'POST /api/v1/webhooks/clerk',
]

function operationsOf(doc: OpenAPIObject) {
  return Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item as Record<string, OperationObject>).map(([method, operation]) => ({
      key: `${method.toUpperCase()} ${path}`,
      operation,
    })),
  )
}

function resolve(doc: OpenAPIObject, schemaOrRef: SchemaObject | ReferenceObject): SchemaObject {
  return '$ref' in schemaOrRef
    ? (doc.components!.schemas![schemaOrRef.$ref.split('/').pop()!] as SchemaObject)
    : schemaOrRef
}

/** Fields without `example`, walking `$ref`s and nested objects. */
function fieldsWithoutExample(
  doc: OpenAPIObject,
  schemaOrRef: SchemaObject | ReferenceObject,
  prefix: string,
): string[] {
  const schema = resolve(doc, schemaOrRef)
  return Object.entries(schema.properties ?? {}).flatMap(([name, field]) => {
    const path = `${prefix} ${name}`
    const nested = '$ref' in field || field.properties ? fieldsWithoutExample(doc, field, path) : []
    const lacksExample = !('$ref' in field) && !field.properties && field.example === undefined
    return lacksExample ? [path, ...nested] : nested
  })
}

describe('docs with DOCS_ENABLED=false', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ env: { DOCS_ENABLED: 'false' } })
  })

  afterAll(() => t.close())

  it.each([
    ['GET', '/api/v1/docs'],
    ['GET', '/api/v1/openapi'],
  ])('%s %s answers 404', async (_method, path) => {
    const res = await t.http().get(path)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
