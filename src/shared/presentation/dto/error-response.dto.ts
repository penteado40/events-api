import { z } from 'zod'
import type { ErrorCode } from '../../domain/app-error.js'
import { ERROR_CATALOG } from '../error-catalog.js'

const ERROR_CODES = Object.keys(ERROR_CATALOG) as [ErrorCode, ...ErrorCode[]]

const ValidationDetailSchema = z.object({ path: z.string(), message: z.string() })

/** The error envelope of ADR-0008: built by the exception filter, documented in the OpenAPI. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.array(ValidationDetailSchema).optional(),
  }),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type ValidationDetail = z.infer<typeof ValidationDetailSchema>
