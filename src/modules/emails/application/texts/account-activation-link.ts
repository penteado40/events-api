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
function formatExpiry(at: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    EXPIRY.formatToParts(at).find((p) => p.type === type)?.value ?? ''
  return `${part('day')}/${part('month')}/${part('year')} às ${part('hour')}:${part('minute')}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** The fixed pt-BR text of the account's Activation link (ADR-0006, PROJ-118). */
export function accountActivationLinkText(input: {
  platformName: string
  name: string
  url: string
  expiresAt: Date
}): EmailText {
  const greeting = `Olá, ${input.name}!`
  const intro = `Sua conta na ${input.platformName} foi criada. Para entrar pela primeira vez, abra o link abaixo e defina uma senha ou use a sua conta Google ou Apple deste email:`
  const expiry = `O link vale até ${formatExpiry(input.expiresAt)} (horário de Brasília). Se ele expirar, peça um novo a quem criou a sua conta.`
  const url = escapeHtml(input.url)
  return {
    subject: `Ative sua conta na ${input.platformName}`,
    text: [greeting, '', intro, '', input.url, '', expiry].join('\n'),
    html: [
      `<p>${escapeHtml(greeting)}</p>`,
      `<p>${escapeHtml(intro)}</p>`,
      `<p><a href="${url}">Ativar minha conta</a></p>`,
      `<p>Se o botão não abrir, copie este endereço no navegador:<br>${url}</p>`,
      `<p>${escapeHtml(expiry)}</p>`,
    ].join('\n'),
  }
}
