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
  USER_DEACTIVATED: {
    status: 401,
    message: 'Este usuário foi desativado e não tem mais acesso à plataforma.',
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
  LAST_OWNER: {
    status: 409,
    message: 'O Group não pode ficar sem Owner: defina outro Owner antes.',
  },
  TEAM_NAME_TAKEN: { status: 409, message: 'Já existe um Team com este nome neste Group.' },
  EVENT_PERIOD_INVALID: {
    status: 400,
    message: 'A data final do Event não pode ser antes da data inicial.',
  },
  EVENT_ITEM_TIME_WITHOUT_DATE: {
    status: 400,
    message: 'O Event item só pode ter hora se tiver data.',
  },
  EVENT_ITEM_ORDER_MIXED: {
    status: 400,
    message:
      'Só se ordenam Event items onde a hora não decide: todos sem data, todos do mesmo dia sem hora ou todos do mesmo dia e hora.',
  },
  EVENT_ITEM_ORDER_INCOMPLETE: {
    status: 409,
    message: 'A nova ordem precisa trazer todos os Event items empatados, como estão agora.',
  },
  EVENT_NOT_DRAFT: { status: 409, message: 'Só um Event em Draft pode ser publicado.' },
  EVENT_CANCELLED: {
    status: 409,
    message: 'O Event está cancelado: nada nele muda até ser descancelado.',
  },
  EVENT_NOT_CANCELLED: { status: 409, message: 'O Event não está cancelado.' },
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
