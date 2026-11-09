import { type EmailText, escapeHtml } from './shared.js'

/** The fixed pt-BR text of the entry into a Group of a User who is already active (PROJ-118, PROJ-174). */
export function groupAccessText(input: {
  platformName: string
  groupName: string
  name: string
}): EmailText {
  const greeting = `Olá, ${input.name}!`
  const body = `Você foi adicionado ao grupo ${input.groupName} na ${input.platformName}. Abra o app e entre com a sua conta para acessar o grupo.`
  return {
    subject: `Você foi adicionado ao grupo ${input.groupName}`,
    text: [greeting, '', body].join('\n'),
    html: [`<p>${escapeHtml(greeting)}</p>`, `<p>${escapeHtml(body)}</p>`].join('\n'),
  }
}
