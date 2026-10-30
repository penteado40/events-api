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

/** What the global guard answers on any non-public route (ADR-0020). */
const GUARD_CODES: readonly ErrorCode[] = ['UNAUTHENTICATED', 'USER_NOT_INVITED']

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

/**
 * Applies what the decorators mark to every operation: a public route opts out
 * of the global security requirement, and the error responses come from the
 * ERROR_CATALOG (ADR-0008): the codes of `@ApiErrors`, plus the 401s of the
 * guard (UNAUTHENTICATED, USER_NOT_INVITED) on every non-public route and 400 VALIDATION_ERROR on every route with a body
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
      if (operation) completeOperation(operation)
    }
  }
  return document
}

const RETRY_AFTER_HEADER = {
  'Retry-After': {
    description: 'Segundos até a janela do rate limit terminar.',
    schema: { type: 'integer' },
  },
}

function completeOperation(operation: OperationObject): void {
  const extensions = operation as unknown as Record<string, unknown>
  const isPublic = extensions[PUBLIC_EXTENSION] === true
  delete extensions[PUBLIC_EXTENSION]
  if (isPublic) operation.security = []

  const codes = new Set<ErrorCode>()
  if (operation.requestBody || operation.parameters?.length) codes.add('VALIDATION_ERROR')
  if (!isPublic) for (const code of GUARD_CODES) codes.add(code)
  for (const code of (extensions[ERROR_CODES_EXTENSION] ?? []) as ErrorCode[]) codes.add(code)

  const byStatus = new Map<number, ErrorCode[]>()
  for (const code of codes) {
    const { status } = ERROR_CATALOG[code]
    byStatus.set(status, [...(byStatus.get(status) ?? []), code])
  }

  for (const [status, statusCodes] of byStatus) {
    operation.responses[String(status)] = {
      description: statusCodes.map((code) => `\`${code}\``).join(', '),
      ...(statusCodes.includes('RATE_LIMITED') && { headers: RETRY_AFTER_HEADER }),
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
