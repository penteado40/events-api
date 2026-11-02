import type { ErrorCode } from '../domain/app-error.js'

interface CatalogEntry {
  status: number
  message: string
}

/** Error code → HTTP status and default message (ADR-0008). */
export const ERROR_CATALOG: Record<ErrorCode, CatalogEntry> = {
  VALIDATION_ERROR: { status: 400, message: 'Dados inválidos.' },
  UNAUTHENTICATED: { status: 401, message: 'Autenticação necessária.' },
  USER_NOT_INVITED: {
    status: 401,
    message:
      'Nenhum usuário da plataforma tem este email. Entre com o email que foi cadastrado para você.',
  },
  FORBIDDEN: { status: 403, message: 'Você não tem permissão para esta ação.' },
  NOT_FOUND: { status: 404, message: 'Recurso não encontrado.' },
  EMAIL_ALREADY_IN_USE: { status: 409, message: 'Já existe um usuário com este email.' },
  USER_ALREADY_ACTIVE: { status: 409, message: 'Este usuário já está ativo.' },
  ALREADY_A_GROUP_MEMBER: { status: 409, message: 'Esta pessoa já é Group member deste Group.' },
  SUPER_ADMIN_NOT_A_GROUP_MEMBER: {
    status: 409,
    message: 'O Super admin não pode ser Group member.',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Muitas tentativas. Tente de novo em alguns minutos.',
  },
  INTERNAL_ERROR: { status: 500, message: 'Erro interno. Tente novamente mais tarde.' },
}

/** Nest/Express HTTP exceptions that reach the filter, by status. */
export const CODE_BY_HTTP_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
}
