import type { OpenAPIObject, OperationObject } from '@nestjs/swagger'
import { z } from 'zod'
import type { ErrorCode } from '../domain/app-error.js'
import { ErrorResponseSchema } from './dto/error-response.dto.js'
import { ERROR_CATALOG } from './error-catalog.js'

/**
 * Set by `@ApiErrors(...)`: the business errors of the route. Kept in the
 * document, so the docs test can tell "declared none" from "forgot to declare".
 */
export const ERROR_CODES_EXTENSION = 'x-error-codes'
/** Set by `@Public()`: the route takes no token. */
export const PUBLIC_EXTENSION = 'x-public'
/** Set by `@AcceptsApiKey()`: the route also takes the Site's `X-Api-Key`. */
export const API_KEY_EXTENSION = 'x-api-key'
/** The name of the `X-Api-Key` security scheme registered in `setupDocs`. */
export const API_KEY_SCHEME = 'apiKey'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

/**
 * Applies what the decorators mark to every operation: a public route opts out
 * of the global security requirement, one that accepts the `X-Api-Key` adds it
 * as an alternative, and the error responses come from the
 * ERROR_CATALOG (ADR-0008): the codes of `@ApiErrors`, plus 401 UNAUTHENTICATED
 * on every non-public route and 400 VALIDATION_ERROR on every route with a body
 * or parameters.
 */
export function completeOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {}
  document.components.schemas ??= {}
  document.components.schemas.ErrorResponse = z.toJSONSchema(ErrorResponseSchema, {
    target: 'openapi-3.0',
  }) as object

  for (const item of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method]
      if (operation) completeOperation(operation, document.security ?? [])
    }
  }
  return document
}

function completeOperation(
  operation: OperationObject,
  globalSecurity: NonNullable<OpenAPIObject['security']>,
): void {
  const extensions = operation as unknown as Record<string, unknown>
  const isPublic = extensions[PUBLIC_EXTENSION] === true
  const acceptsApiKey = extensions[API_KEY_EXTENSION] === true
  delete extensions[PUBLIC_EXTENSION]
  delete extensions[API_KEY_EXTENSION]
  if (isPublic) operation.security = []
  else if (acceptsApiKey) operation.security = [...globalSecurity, { [API_KEY_SCHEME]: [] }]

  const codes = new Set<ErrorCode>()
  if (operation.requestBody || operation.parameters?.length) codes.add('VALIDATION_ERROR')
  if (!isPublic) codes.add('UNAUTHENTICATED')
  for (const code of (extensions[ERROR_CODES_EXTENSION] ?? []) as ErrorCode[]) codes.add(code)

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
