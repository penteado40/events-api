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
  WEAK_PASSWORD: {
    status: 400,
    message:
      'A senha precisa ter de 8 caracteres a 72 bytes, com ao menos uma letra maiúscula, uma minúscula, um número e um símbolo.',
  },
  INVALID_CURRENT_PASSWORD: { status: 400, message: 'A senha atual está incorreta.' },
  EMAIL_ALREADY_IN_USE: { status: 409, message: 'Já existe um usuário com este email.' },
  USER_ALREADY_ACTIVE: { status: 409, message: 'Este usuário já está ativo.' },
  USER_PENDING: {
    status: 403,
    message: 'Usuário ainda não ativado. Use o link de ativação que você recebeu.',
  },
  ACTIVATION_LINK_INVALID: {
    status: 400,
    message: 'Link de ativação inválido. Peça um novo a quem criou seu usuário.',
  },
  ACTIVATION_LINK_USED: {
    status: 409,
    message: 'Este link de ativação já foi usado. Faça login com sua senha.',
  },
  ACTIVATION_LINK_EXPIRED: {
    status: 410,
    message: 'Link de ativação expirado. Peça um novo a quem criou seu usuário.',
  },
  SLUG_ALREADY_IN_USE: { status: 409, message: 'Já existe um evento com este slug.' },
  PRIMARY_OWNER_INVALID: {
    status: 422,
    message: 'O Primary owner precisa ser um usuário existente que não seja Super admin.',
  },
  EVENT_ARCHIVED: {
    status: 409,
    message: 'Este evento está arquivado e não aceita alterações.',
  },
  INSUFFICIENT_SCOPE: {
    status: 403,
    message: 'Este API token não tem o Scope necessário para esta ação.',
  },
  MEMBER_NOT_FOUND: { status: 404, message: 'Este usuário não é membro do evento.' },
  MEMBER_ALREADY_EXISTS: { status: 409, message: 'Este usuário já é membro do evento.' },
  USER_IS_SUPER_ADMIN: {
    status: 409,
    message: 'O Super admin já tem acesso a todos os eventos e não pode ser membro.',
  },
  TRANSFER_TARGET_NOT_OWNER: {
    status: 409,
    message: 'O posto de Primary owner só pode ir para um Owner do evento.',
  },
  PRIMARY_OWNER_MUST_TRANSFER: {
    status: 409,
    message: 'Transfira o posto de Primary owner para outro Owner antes.',
  },
  MEMBER_CHANGED: {
    status: 409,
    message:
      'Este membro foi alterado por outra pessoa ao mesmo tempo. Recarregue e tente de novo.',
  },
  API_TOKEN_NOT_FOUND: { status: 404, message: 'API token não encontrado neste evento.' },
  INTERNAL_ERROR: { status: 500, message: 'Erro interno. Tente novamente mais tarde.' },
}

/** Nest/Express HTTP exceptions that reach the filter, by status. */
export const CODE_BY_HTTP_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
}
