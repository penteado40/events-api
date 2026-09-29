import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  RequestBodyObject,
  SchemaObject,
} from '@nestjs/swagger'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser } from './support/factories.js'
import { registeredRoutes } from './support/routes.js'

describe('docs with DOCS_ENABLED=true', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ env: { DOCS_ENABLED: 'true' } })
    await createUser({ email: 'docs@example.com', password: 'correct-password' })
    await createUser({ email: 'pending@example.com', password: null })
  })

  afterAll(() => t.close())

  it('serves the OpenAPI document with the OAuth2 login of Scalar', async () => {
    const res = await t.http().get('/api/v1/openapi')

    expect(res.status).toBe(200)
    expect(res.body.openapi).toMatch(/^3\./)
    expect(res.body.components.securitySchemes.oauth2.flows.password.tokenUrl).toBe(
      '/api/v1/auth/token',
    )
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

      expect(registered).toContain('POST /api/v1/auth/login')
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
      expect(doc.security).toEqual([{ oauth2: [] }, { bearer: [] }])
      const publicOnes = operationsOf(doc)
        .filter(({ operation }) => operation.security?.length === 0)
        .map(({ key }) => key)

      expect(publicOnes.sort()).toEqual(['POST /api/v1/auth/activate', 'POST /api/v1/auth/login'])
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

  it('issues an OAuth2 token from a form-urlencoded password grant', async () => {
    const res = await t.http().post('/api/v1/auth/token').type('form').send({
      grant_type: 'password',
      username: 'DOCS@example.com',
      password: 'correct-password',
    })

    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toEqual({
      access_token: expect.any(String),
      token_type: 'bearer',
      expires_in: 43200,
    })

    const me = await t.http().get('/api/v1/me').auth(res.body.access_token, { type: 'bearer' })
    expect(me.status).toBe(200)
  })

  it('answers bad credentials with 400 invalid_grant (RFC 6749)', async () => {
    const res = await t.http().post('/api/v1/auth/token').type('form').send({
      grant_type: 'password',
      username: 'docs@example.com',
      password: 'wrong-password',
    })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_grant' })
  })

  it('answers a Pending user with 400 invalid_grant too', async () => {
    const res = await t.http().post('/api/v1/auth/token').type('form').send({
      grant_type: 'password',
      username: 'pending@example.com',
      password: 'anything',
    })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_grant' })
  })

  it('answers other grant types with 400 unsupported_grant_type', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/token')
      .type('form')
      .send({ grant_type: 'client_credentials', username: 'a', password: 'b' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'unsupported_grant_type' })
  })
})

/** Routes left out of the docs on purpose. */
const UNDOCUMENTED_ROUTES = [
  'GET /api/v1/docs',
  'GET /api/v1/openapi',
  // OAuth2 grant behind the Authorize button of Scalar, outside the API contract.
  'POST /api/v1/auth/token',
]

function operationsOf(doc: OpenAPIObject) {
  return Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item as Record<string, OperationObject>).map(([method, operation]) => ({
      key: `${method.toUpperCase()} ${path}`,
      operation,
    })),
  )
}

/** Fields without `example`, walking `$ref`s and nested objects. */
function fieldsWithoutExample(
  doc: OpenAPIObject,
  schemaOrRef: SchemaObject | ReferenceObject,
  prefix: string,
): string[] {
  const schema =
    '$ref' in schemaOrRef
      ? (doc.components!.schemas![schemaOrRef.$ref.split('/').pop()!] as SchemaObject)
      : schemaOrRef
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
    ['POST', '/api/v1/auth/token'],
  ])('%s %s answers 404', async (method, path) => {
    const res = method === 'GET' ? await t.http().get(path) : await t.http().post(path).send({})

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
