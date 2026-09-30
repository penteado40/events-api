import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'
import type { Request } from 'express'
import { API_KEY_EXTENSION } from './openapi-document.js'

/** The header the Site sends its API token in (ADR-0008); `Authorization` is for the JWT. */
export const API_KEY_HEADER = 'X-Api-Key'
export const ACCEPTS_API_KEY = 'acceptsApiKey'

/**
 * Checks an `X-Api-Key` value, throwing UNAUTHENTICATED when it is not an
 * active credential. The context that owns the API tokens provides it.
 */
export abstract class ApiKeyAuthenticator {
  abstract authenticate(value: string): Promise<object>
}

/** A route the Site may call with its API token, besides a User with a JWT. */
export const AcceptsApiKey = () =>
  applyDecorators(SetMetadata(ACCEPTS_API_KEY, true), ApiExtension(API_KEY_EXTENSION, true))

export type RequestWithApiKey = Request & { apiKey?: object }

/** What the ApiKeyAuthenticator gave for the request's `X-Api-Key`; undefined for a JWT. */
export const CurrentApiKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<RequestWithApiKey>().apiKey,
)
