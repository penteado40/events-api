import type { OpenAPIObject } from '@nestjs/swagger'
import { describe, expect, it } from 'vitest'
import { documentErrors } from './openapi-errors.js'

function docWith(operation: Record<string, unknown>): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 't', version: 'v1' },
    paths: { '/x': { post: { responses: { '200': { description: '' } }, ...operation } } },
  }
}

const op = (doc: OpenAPIObject) => doc.paths['/x']!.post!

describe('documentErrors', () => {
  it('groups the declared codes by the status of the catalog, one example each', () => {
    const doc = documentErrors(
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
                  message: 'A senha precisa ter pelo menos 12 caracteres e no máximo 72 bytes.',
                },
              },
            },
          },
        },
      },
    })
  })

  it('adds 401 UNAUTHENTICATED to every route that is not public', () => {
    const doc = documentErrors(docWith({}))

    expect(op(doc).responses['401']).toMatchObject({ description: '`UNAUTHENTICATED`' })
    expect(op(doc).security).toBeUndefined()
  })

  it('clears the global security of a public route and adds no 401', () => {
    const doc = documentErrors(docWith({ 'x-public': true }))

    expect(op(doc).security).toEqual([])
    expect(op(doc).responses['401']).toBeUndefined()
  })

  it('adds 400 VALIDATION_ERROR to routes with a body or parameters, next to declared codes', () => {
    const withBody = documentErrors(
      docWith({ 'x-public': true, 'x-error-codes': ['WEAK_PASSWORD'], requestBody: {} }),
    )
    const withParams = documentErrors(docWith({ 'x-public': true, parameters: [{ name: 'id' }] }))
    const bare = documentErrors(docWith({ 'x-public': true }))

    expect(op(withBody).responses['400']).toMatchObject({
      description: '`VALIDATION_ERROR`, `WEAK_PASSWORD`',
    })
    expect(op(withParams).responses['400']).toMatchObject({ description: '`VALIDATION_ERROR`' })
    expect(op(bare).responses['400']).toBeUndefined()
  })

  it('declares the error envelope once and removes the extensions', () => {
    const doc = documentErrors(docWith({ 'x-error-codes': ['FORBIDDEN'] }))

    expect(doc.components?.schemas?.ErrorResponse).toBeDefined()
    expect(op(doc)).not.toHaveProperty('x-error-codes')
    expect(op(doc)).not.toHaveProperty('x-public')
  })
})
