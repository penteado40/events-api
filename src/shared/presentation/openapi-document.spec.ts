import type { OpenAPIObject } from '@nestjs/swagger'
import { describe, expect, it } from 'vitest'
import { completeOpenApiDocument } from './openapi-document.js'

function docWith(operation: Record<string, unknown>): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 't', version: 'v1' },
    paths: { '/x': { post: { responses: { '200': { description: '' } }, ...operation } } },
  }
}

const op = (doc: OpenAPIObject) => doc.paths['/x']!.post!

describe('completeOpenApiDocument', () => {
  it('groups the declared codes by the status of the catalog, one example each', () => {
    const doc = completeOpenApiDocument(
      docWith({ 'x-public': true, 'x-error-codes': ['WEAK_PASSWORD', 'EMAIL_ALREADY_IN_USE'] }),
    )

    const responses = op(doc).responses
    expect(Object.keys(responses)).toEqual(['200', '400', '409'])
    expect(responses['400']).toMatchObject({
      description: '`WEAK_PASSWORD`',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          examples: {
            WEAK_PASSWORD: {
              value: {
                error: {
                  code: 'WEAK_PASSWORD',
                  message:
                    'A senha precisa ter de 8 caracteres a 72 bytes, com ao menos uma letra maiúscula, uma minúscula, um número e um símbolo.',
                },
              },
            },
          },
        },
      },
    })
  })

  it('adds 401 UNAUTHENTICATED to every route that is not public', () => {
    const doc = completeOpenApiDocument(docWith({}))

    expect(op(doc).responses['401']).toMatchObject({ description: '`UNAUTHENTICATED`' })
    expect(op(doc).security).toBeUndefined()
  })

  it('clears the global security of a public route and adds no 401', () => {
    const doc = completeOpenApiDocument(docWith({ 'x-public': true }))

    expect(op(doc).security).toEqual([])
    expect(op(doc).responses['401']).toBeUndefined()
  })

  it('lets a route that accepts the X-Api-Key be called with it, besides the global security', () => {
    const doc = completeOpenApiDocument({
      ...docWith({ 'x-api-key': true }),
      security: [{ bearer: [] }],
    })

    expect(op(doc).security).toEqual([{ bearer: [] }, { apiKey: [] }])
    expect(op(doc).responses['401']).toMatchObject({ description: '`UNAUTHENTICATED`' })
    expect(op(doc) as unknown as Record<string, unknown>).not.toHaveProperty('x-api-key')
  })

  it('adds 400 VALIDATION_ERROR to routes with a body or parameters, next to declared codes', () => {
    const withBody = completeOpenApiDocument(
      docWith({ 'x-public': true, 'x-error-codes': ['WEAK_PASSWORD'], requestBody: {} }),
    )
    const withParams = completeOpenApiDocument(
      docWith({ 'x-public': true, parameters: [{ name: 'id' }] }),
    )
    const bare = completeOpenApiDocument(docWith({ 'x-public': true }))

    expect(op(withBody).responses['400']).toMatchObject({
      description: '`VALIDATION_ERROR`, `WEAK_PASSWORD`',
    })
    expect(op(withParams).responses['400']).toMatchObject({ description: '`VALIDATION_ERROR`' })
    expect(op(bare).responses['400']).toBeUndefined()
  })

  it('declares the error envelope once, from the schema the exception filter follows', () => {
    const doc = completeOpenApiDocument(docWith({ 'x-error-codes': ['FORBIDDEN'] }))

    expect(doc.components?.schemas?.ErrorResponse).toMatchObject({
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          required: ['code', 'message'],
          properties: { code: { enum: expect.arrayContaining(['FORBIDDEN']) } },
        },
      },
    })
  })

  it('keeps the declared codes, so the docs test can require them, and drops x-public', () => {
    const doc = completeOpenApiDocument(docWith({ 'x-public': true, 'x-error-codes': [] }))

    expect(op(doc)).toHaveProperty('x-error-codes', [])
    expect(op(doc)).not.toHaveProperty('x-public')
  })
})
