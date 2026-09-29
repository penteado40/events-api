import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'
import { PUBLIC_EXTENSION } from './openapi-document.js'

export const IS_PUBLIC_KEY = 'isPublic'

/** Opts a route out of the global JwtAuthGuard, and out of the security of the docs. */
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiExtension(PUBLIC_EXTENSION, true))
