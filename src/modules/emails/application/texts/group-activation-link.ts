import { type EmailText, escapeHtml, formatExpiry } from './shared.js'

/** The fixed pt-BR text of the Activation link of a Group (PROJ-118, PROJ-174). */
export function groupActivationLinkText(input: {
  platformName: string
  groupName: string
  name: string
  url: string
  expiresAt: Date
}): EmailText {
  const greeting = `Olá, ${input.name}!`
  const intro = `Você foi adicionado ao grupo ${input.groupName} na ${input.platformName}. Para entrar pela primeira vez, abra o link abaixo e defina uma senha ou use a sua conta Google ou Apple deste email:`
  const expiry = `O link vale até ${formatExpiry(input.expiresAt)} (horário de Brasília). Se ele expirar, peça um novo a quem adicionou você ao grupo.`
  const url = escapeHtml(input.url)
  return {
    subject: `Você foi adicionado ao grupo ${input.groupName}`,
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
