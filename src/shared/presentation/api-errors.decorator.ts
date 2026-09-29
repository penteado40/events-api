import { ApiExtension } from '@nestjs/swagger'
import type { ErrorCode } from '../domain/app-error.js'
import { ERROR_CODES_EXTENSION } from './openapi-errors.js'

/**
 * Documents the business errors a route answers; status and message come from
 * the ERROR_CATALOG. 401 and 400 VALIDATION_ERROR are added on their own
 * (see `documentErrors`).
 */
export const ApiErrors = (...codes: ErrorCode[]) => ApiExtension(ERROR_CODES_EXTENSION, codes)
