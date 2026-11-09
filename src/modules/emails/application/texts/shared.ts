/** A rendered email: the subject and the same text as plain text and html. */
export interface EmailText {
  subject: string
  text: string
  html: string
}

const EXPIRY = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "08/11/2026 às 12:00", in Brasília time. */
export function formatExpiry(at: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    EXPIRY.formatToParts(at).find((p) => p.type === type)?.value ?? ''
  return `${part('day')}/${part('month')}/${part('year')} às ${part('hour')}:${part('minute')}`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
