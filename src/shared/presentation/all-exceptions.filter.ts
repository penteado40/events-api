import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import { ZodError } from 'zod'
import { AppError, type ErrorCode } from '../domain/app-error.js'
import { CODE_BY_HTTP_STATUS, ERROR_CATALOG } from './error-catalog.js'

interface ValidationDetail {
  path: string
  message: string
}

interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown }
}

export interface AllExceptionsFilterOptions {
  /** Outside production, 500s carry the original message to ease debugging. */
  exposeInternalErrors: boolean
}

/** Turns every exception into `{ error: { code, message, details? } }` (ADR-0008). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter')

  constructor(private readonly options: AllExceptionsFilterOptions) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const { status, body } = this.toResponse(exception)
    response.status(status).json(body)
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof AppError) return fromCode(exception.code)

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError()
      const details = zodError instanceof ZodError ? toDetails(zodError) : undefined
      return fromCode('VALIDATION_ERROR', details)
    }

    const clientStatus = clientErrorStatus(exception)
    if (clientStatus) {
      // Other 4xx (413, 415...) keep their status; the request was still invalid.
      const response = fromCode(CODE_BY_HTTP_STATUS[clientStatus] ?? 'VALIDATION_ERROR')
      return { ...response, status: clientStatus }
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : exception,
    )
    const internal = fromCode('INTERNAL_ERROR')
    if (this.options.exposeInternalErrors && exception instanceof Error) {
      internal.body.error.message = exception.message
    }
    return internal
  }
}

function fromCode(code: ErrorCode, details?: unknown): { status: number; body: ErrorBody } {
  const { status, message } = ERROR_CATALOG[code]
  const error: ErrorBody['error'] = { code, message }
  if (details !== undefined) error.details = details
  return { status, body: { error } }
}

/** 4xx status of a Nest HttpException or of an Express `http-errors` error (body parser). */
function clientErrorStatus(exception: unknown): number | undefined {
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : isExposedHttpError(exception)
        ? exception.status
        : undefined
  return status !== undefined && status >= 400 && status < 500 ? status : undefined
}

function isExposedHttpError(error: unknown): error is { status: number; expose: true } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'expose' in error &&
    error.expose === true
  )
}

function toDetails(error: ZodError): ValidationDetail[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}
