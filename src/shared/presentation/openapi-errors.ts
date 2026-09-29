import type { OpenAPIObject, OperationObject } from '@nestjs/swagger'
import type { ErrorCode } from '../domain/app-error.js'
import { ERROR_CATALOG } from './error-catalog.js'

/** Set by `@ApiErrors(...)`: the business errors of the route. */
export const ERROR_CODES_EXTENSION = 'x-error-codes'
/** Set by `@Public()`: the route takes no token. */
export const PUBLIC_EXTENSION = 'x-public'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: { path: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
}

/**
 * Documents the error responses of every operation from the ERROR_CATALOG
 * (ADR-0008): the codes declared with `@ApiErrors`, plus 401 UNAUTHENTICATED on
 * every non-public route and 400 VALIDATION_ERROR on every route with a body or
 * parameters. Public routes opt out of the global security requirement.
 */
export function documentErrors(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {}
  document.components.schemas ??= {}
  document.components.schemas.ErrorResponse = ERROR_RESPONSE_SCHEMA

  for (const item of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method]
      if (operation) documentOperation(operation)
    }
  }
  return document
}

function documentOperation(operation: OperationObject): void {
  const extensions = operation as unknown as Record<string, unknown>
  const isPublic = extensions[PUBLIC_EXTENSION] === true
  const declared = (extensions[ERROR_CODES_EXTENSION] ?? []) as ErrorCode[]
  delete extensions[PUBLIC_EXTENSION]
  delete extensions[ERROR_CODES_EXTENSION]

  const codes = new Set<ErrorCode>()
  if (operation.requestBody || operation.parameters?.length) codes.add('VALIDATION_ERROR')
  if (isPublic) operation.security = []
  else codes.add('UNAUTHENTICATED')
  for (const code of declared) codes.add(code)

  const byStatus = new Map<number, ErrorCode[]>()
  for (const code of codes) {
    const { status } = ERROR_CATALOG[code]
    byStatus.set(status, [...(byStatus.get(status) ?? []), code])
  }

  for (const [status, statusCodes] of byStatus) {
    operation.responses[String(status)] = {
      description: statusCodes.map((code) => `\`${code}\``).join(', '),
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          examples: Object.fromEntries(
            statusCodes.map((code) => [
              code,
              { value: { error: { code, message: ERROR_CATALOG[code].message } } },
            ]),
          ),
        },
      },
    }
  }
}
