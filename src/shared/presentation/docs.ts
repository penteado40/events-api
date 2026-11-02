import { randomBytes } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { customThemeCSS } from '@scalar/nestjs-api-reference'
import type { Request, Response } from 'express'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { API_PREFIX } from './api-prefix.js'
import { completeOpenApiDocument } from './openapi-document.js'

export const DOCS_PATH = `/${API_PREFIX}/docs`
export const OPENAPI_PATH = `/${API_PREFIX}/openapi`

const SCALAR_CDN = 'https://cdn.jsdelivr.net'
/** Pinned: `onBeforeRequest` and its `requestBuilder` are experimental in Scalar. */
const SCALAR_BUNDLE = `${SCALAR_CDN}/npm/@scalar/api-reference@1.76.4`

/** What the docs need to sign in with Clerk: from `CLERK_PUBLISHABLE_KEY`. */
export interface DocsClerkLogin {
  publishableKey: string
  /** The Frontend API host the key encodes, which serves Clerk JS and its UI. */
  frontendApi: string
}

/**
 * Registers Scalar and the OpenAPI document. Only called with DOCS_ENABLED=true,
 * so both routes 404 otherwise. With `clerk`, the page also signs in with Clerk
 * and sends the session token on each request (ADR-0008); without it, the token
 * is pasted by hand in Authorize.
 */
export function setupDocs(app: INestApplication, clerk: DocsClerkLogin | null): void {
  const config = new DocumentBuilder()
    .setTitle('events-api')
    .setDescription('API multi-evento: RSVP, lista de presentes e emails para convidados.')
    .setVersion('v1')
    // The Clerk session token (ADR-0020): sent by the Clerk login of the page or pasted by hand.
    .addBearerAuth()
    // Every route takes a token unless it is @Public() (see completeOpenApiDocument).
    .addSecurityRequirements('bearer')
    .build()
  const document = completeOpenApiDocument(
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)),
  )

  const http = app.getHttpAdapter()
  http.get(OPENAPI_PATH, (_req: Request, res: Response) => res.json(document))
  http.get(DOCS_PATH, (_req: Request, res: Response) => {
    const nonce = randomBytes(16).toString('base64')
    res.setHeader('Content-Security-Policy', docsCsp(nonce, clerk))
    res.type('html').send(docsHtml(nonce, clerk))
  })
}

type Csp = Record<string, string[]>

/** Clerk's hosts (clerk.com/docs/guides/secure/best-practices/csp-headers). */
const TURNSTILE = 'https://challenges.cloudflare.com'
const CLERK_PROTECT = 'https://*.protect.clerk.com'

function docsCsp(nonce: string, clerk: DocsClerkLogin | null): string {
  const csp: Csp = {
    'default-src': ["'none'"],
    'script-src': [`'nonce-${nonce}'`, SCALAR_CDN],
    // Scalar and Clerk both inject styles at runtime.
    'style-src': ["'self'", "'unsafe-inline'", SCALAR_CDN],
    'font-src': ["'self'", 'data:', SCALAR_CDN, 'https://fonts.scalar.com'],
    'img-src': ["'self'", 'data:', SCALAR_CDN],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
  }
  const withClerk = clerk ? mergeCsp(csp, clerkCsp(clerk)) : csp
  return Object.entries(withClerk)
    .map(([name, sources]) => [name, ...sources].join(' '))
    .join('; ')
}

/** What Clerk adds: its Frontend API, its images, the bot protection (Turnstile) and the abuse protection. */
function clerkCsp(clerk: DocsClerkLogin): Csp {
  const frontendApi = `https://${clerk.frontendApi}`
  return {
    'script-src': [frontendApi, TURNSTILE, CLERK_PROTECT],
    'img-src': ['https://img.clerk.com'],
    'connect-src': [frontendApi, `${CLERK_PROTECT}:*`, 'https://clerk-telemetry.com'],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': [TURNSTILE, CLERK_PROTECT],
    // Clerk's forms post through fetch and social login is a redirect, so 'self'
    // is only a fallback; without Clerk the page has no form at all.
    'form-action': ["'self'"],
  }
}

/** Adds the sources of `extra`, except for a `'none'`, which `extra` replaces. */
function mergeCsp(base: Csp, extra: Csp): Csp {
  const merged = { ...base }
  for (const [name, sources] of Object.entries(extra)) {
    const current = (merged[name] ?? []).filter((source) => source !== "'none'")
    merged[name] = [...current, ...sources]
  }
  return merged
}

function docsHtml(nonce: string, clerk: DocsClerkLogin | null): string {
  const nonceAttr = `nonce="${escapeAttr(nonce)}"`
  const scalarConfig = `{
        url: ${JSON.stringify(OPENAPI_PATH)},
        authentication: { preferredSecurityScheme: 'bearer' },${clerk ? '\n        onBeforeRequest: sendClerkToken,' : ''}
      }`
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <title>events-api</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta property="csp-nonce" content="${escapeAttr(nonce)}" />
    <style ${nonceAttr}>${customThemeCSS}${clerk ? CLERK_BAR_CSS : ''}</style>
  </head>
  <body>${clerk ? CLERK_BAR_HTML : ''}
    <div id="app"></div>
    <script src="${SCALAR_BUNDLE}" ${nonceAttr}></script>${clerk ? clerkScripts(nonceAttr, clerk) : ''}
    <script ${nonceAttr}>
      Scalar.createApiReference('#app', ${scalarConfig})
    </script>
  </body>
</html>`
}

const CLERK_BAR_HTML = `
    <header id="clerk-bar">
      <span id="clerk-status">Carregando o Clerk...</span>
      <button id="clerk-sign-in" type="button" hidden>Entrar com Clerk</button>
      <button id="clerk-sign-out" type="button" hidden>Sair</button>
    </header>`

const CLERK_BAR_CSS = `
#clerk-bar {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px;
  padding: 8px 16px; font: 14px system-ui, sans-serif;
  border-bottom: 1px solid rgba(127, 127, 127, 0.25);
}
#clerk-bar button { font: inherit; padding: 4px 12px; cursor: pointer; }
`

function clerkScripts(nonceAttr: string, clerk: DocsClerkLogin): string {
  const base = `https://${clerk.frontendApi}/npm`
  return `
    <script src="${base}/@clerk/ui@1/dist/ui.browser.js" crossorigin="anonymous" ${nonceAttr}></script>
    <script src="${base}/@clerk/clerk-js@6/dist/clerk.browser.js" crossorigin="anonymous" data-clerk-publishable-key="${escapeAttr(clerk.publishableKey)}" ${nonceAttr}></script>
    <script ${nonceAttr}>
      // A token pasted in Authorize wins: Clerk's is sent only when none was pasted.
      async function sendClerkToken({ requestBuilder }) {
        const pasted = (requestBuilder.security || []).some((s) => s.format === 'bearer' && s.value && s.value.trim())
        if (pasted || requestBuilder.headers.has('Authorization')) return
        const session = window.Clerk && window.Clerk.session
        // getToken() renews the short-lived session token, so it never expires mid-test.
        const token = session ? await session.getToken() : null
        if (!token) return
        if (requestBuilder.options) requestBuilder.options.disableSecurity = true
        requestBuilder.headers.set('Authorization', 'Bearer ' + token)
      }

      ;(async () => {
        const status = document.getElementById('clerk-status')
        const signIn = document.getElementById('clerk-sign-in')
        const signOut = document.getElementById('clerk-sign-out')
        try {
          await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } })
        } catch (error) {
          status.textContent = 'Clerk indisponível: cole o token em Authorize.'
          console.error(error)
          return
        }
        const render = () => {
          const user = window.Clerk.user
          status.textContent = user
            ? (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) || user.id
            : 'Sem sessão: só as rotas públicas, ou cole um token em Authorize.'
          signIn.hidden = !!user
          signOut.hidden = !user
        }
        window.Clerk.addListener(render)
        render()
        signIn.addEventListener('click', () => window.Clerk.openSignIn())
        signOut.addEventListener('click', () => window.Clerk.signOut())
      })()
    </script>`
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
