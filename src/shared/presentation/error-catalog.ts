import type { ErrorCode } from '../domain/app-error.js'

interface CatalogEntry {
  status: number
  message: string
}

/** Error code → HTTP status and default message (ADR-0008). */
export const ERROR_CATALOG: Record<ErrorCode, CatalogEntry> = {
  VALIDATION_ERROR: { status: 400, message: 'Dados inválidos.' },
  INVALID_CREDENTIALS: { status: 401, message: 'Email ou senha inválidos.' },
  UNAUTHENTICATED: { status: 401, message: 'Autenticação necessária.' },
  FORBIDDEN: { status: 403, message: 'Você não tem permissão para esta ação.' },
  NOT_FOUND: { status: 404, message: 'Recurso não encontrado.' },
  INTERNAL_ERROR: { status: 500, message: 'Erro interno. Tente novamente mais tarde.' },
}

/** Nest/Express HTTP exceptions that reach the filter, by status. */
export const CODE_BY_HTTP_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
}
