import { z } from 'zod'

/** An origin written exactly as a browser sends it: scheme + host + port, no path, no wildcard. */
function isExactOrigin(value: string): boolean {
  try {
    return !value.includes('*') && new URL(value).origin === value
  } catch {
    return false
  }
}

/** A comma-separated list of exact origins, empty when unset or blank. */
const originList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  )
  .pipe(
    z.array(
      z.string().refine(isExactOrigin, 'cada origem precisa ser exata, ex.: https://painel.com'),
    ),
  )

/**
 * The Frontend API host a Clerk publishable key encodes: `pk_test_` or `pk_live_`
 * plus base64 of `<host>$`. Null when the value is not such a key.
 */
function frontendApiOf(publishableKey: string): string | null {
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/]+={0,2})$/.exec(publishableKey)
  if (!match) return null
  const decoded = Buffer.from(match[1]!, 'base64').toString('utf8')
  if (!decoded.endsWith('$')) return null
  const host = decoded.slice(0, -1)
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}

const UPSTASH_VARS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    /** Activation link lifetime, in whole days: the unit of Clerk's invitations (default 7). */
    ACTIVATION_LINK_TTL_DAYS: z.coerce.number().int().positive().default(7),
    /**
     * Where an Activation link lands once accepted: the events-expo deep link (ADR-0020).
     * Required in production; unset elsewhere, Clerk's default page is used.
     */
    ACTIVATION_REDIRECT_URL: z.url().optional(),
    DOCS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** Comma-separated origins CORS accepts besides localhost outside production (e.g. the Panel). */
    CORS_ORIGINS: originList,
    /** Verifies the Clerk session tokens (ADR-0020). Required in production; tests use a fake. */
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    /** Clerk's PEM public key: verifies tokens without fetching the JWKS (no call per unknown `kid`). */
    CLERK_JWT_KEY: z.string().min(1).optional(),
    /**
     * Origins whose tokens (`azp`) are accepted. Once set, a token without `azp` is refused
     * too: set it only after checking what the app (events-expo) sends.
     */
    CLERK_AUTHORIZED_PARTIES: originList,
    /**
     * Turns on the Clerk login of the docs (`/docs`). Blank or unset, the docs take
     * only a token pasted by hand. Never set in production, where the docs are off.
     */
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .trim()
      .optional()
      .transform((value, ctx) => {
        if (value === undefined || value === '') return undefined
        const frontendApi = frontendApiOf(value)
        if (frontendApi === null) {
          ctx.addIssue({
            code: 'custom',
            message: 'precisa ser uma publishable key do Clerk (pk_test_... ou pk_live_...)',
          })
          return z.NEVER
        }
        return { publishableKey: value, frontendApi }
      }),
    /** The `whsec_...` of Clerk's webhook endpoint, which signs `POST /webhooks/clerk`. Required in production. */
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
    /** The Platform sender's address (ADR-0006), on a domain verified in Resend. Required in production. */
    EMAIL_FROM_ADDRESS: z.email().optional(),
    /** The platform's name: the sender's display name and the text of the account's emails. */
    PLATFORM_NAME: z.string().trim().min(1).optional(),
    /** Sends the emails. Required in production; unset elsewhere, every attempt fails into the Email log. */
    RESEND_API_KEY: z.string().min(1).optional(),
    /** Rate-limit counters (ADR-0007). Required in production; without them, counters stay in memory. */
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    /** Set by Vercel: `1` on its functions, and `production` | `preview` | `development`. */
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.CLERK_SECRET_KEY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLERK_SECRET_KEY'],
        message: 'obrigatória em produção (verificação do token do Clerk)',
      })
    }
    if (env.NODE_ENV === 'production' && env.CLERK_WEBHOOK_SIGNING_SECRET === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLERK_WEBHOOK_SIGNING_SECRET'],
        message: 'obrigatória em produção (assinatura do webhook do Clerk)',
      })
    }
    if (env.NODE_ENV === 'production' && env.ACTIVATION_REDIRECT_URL === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['ACTIVATION_REDIRECT_URL'],
        message: 'obrigatória em produção (deep link do app no Activation link)',
      })
    }
    for (const name of ['EMAIL_FROM_ADDRESS', 'PLATFORM_NAME', 'RESEND_API_KEY'] as const) {
      if (env.NODE_ENV === 'production' && env[name] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'obrigatória em produção (envio de emails)',
        })
      }
    }
    const missing = UPSTASH_VARS.filter((name) => env[name] === undefined)
    const required = env.NODE_ENV === 'production' || missing.length < UPSTASH_VARS.length
    if (!required) return
    for (const name of missing) {
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message:
          env.NODE_ENV === 'production'
            ? 'obrigatória em produção (rate limit compartilhado)'
            : 'as duas variáveis do Upstash vão juntas',
      })
    }
  })

/** Typed, validated environment. Also the injection token for configuration. */
export class AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly port: number
  readonly databaseUrl: string
  readonly docsEnabled: boolean
  readonly activationLinkTtlDays: number
  /** Null outside production when unset: Clerk's default page then receives the invitation. */
  readonly activationRedirectUrl: string | null
  readonly corsOrigins: string[]
  /** Null outside production when unset: nothing then verifies a Clerk token. */
  readonly clerkSecretKey: string | null
  /** Null when unset: Clerk's keys are then fetched (and cached) from its JWKS. */
  readonly clerkJwtKey: string | null
  /** Empty when unset: the token's `azp` is then not checked. */
  readonly clerkAuthorizedParties: string[]
  /** Null when unset: the docs then take only a token pasted by hand. */
  readonly clerkDocsLogin: { publishableKey: string; frontendApi: string } | null
  /** Null outside production when unset: every Clerk webhook is then a server error. */
  readonly clerkWebhookSigningSecret: string | null
  /** The Platform sender (ADR-0006); outside production, placeholders when unset. */
  readonly platformSender: { platformName: string; fromAddress: string }
  /** Null outside production when unset: every email then fails into the Email log. */
  readonly resendApiKey: string | null
  /** Null outside production when unset: the counters then stay in memory. */
  readonly upstash: { url: string; token: string } | null
  /** Prefix of every rate-limit key, one per environment sharing the Upstash database. */
  readonly rateLimitPrefix: string
  /** On Vercel the client IP comes from `x-forwarded-for`, which its edge overwrites. */
  readonly behindVercelProxy: boolean

  private constructor(env: z.output<typeof EnvSchema>) {
    this.nodeEnv = env.NODE_ENV
    this.port = env.PORT
    this.databaseUrl = env.DATABASE_URL
    this.docsEnabled = env.DOCS_ENABLED
    this.activationLinkTtlDays = env.ACTIVATION_LINK_TTL_DAYS
    this.activationRedirectUrl = env.ACTIVATION_REDIRECT_URL ?? null
    this.corsOrigins = env.CORS_ORIGINS
    this.clerkSecretKey = env.CLERK_SECRET_KEY ?? null
    this.clerkJwtKey = env.CLERK_JWT_KEY ?? null
    this.clerkAuthorizedParties = env.CLERK_AUTHORIZED_PARTIES
    this.clerkDocsLogin = env.CLERK_PUBLISHABLE_KEY ?? null
    this.clerkWebhookSigningSecret = env.CLERK_WEBHOOK_SIGNING_SECRET ?? null
    this.platformSender = {
      platformName: env.PLATFORM_NAME ?? 'Events',
      fromAddress: env.EMAIL_FROM_ADDRESS ?? 'noreply@localhost',
    }
    this.resendApiKey = env.RESEND_API_KEY ?? null
    this.upstash =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }
        : null
    this.rateLimitPrefix = `events-api:${env.VERCEL_ENV ?? 'local'}`
    this.behindVercelProxy = env.VERCEL === '1'
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production'
  }

  static fromEnv(source: Record<string, string | undefined> = process.env): AppConfig {
    const parsed = EnvSchema.safeParse(source)
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      throw new Error(`Configuração inválida:\n  ${problems.join('\n  ')}`)
    }
    return new AppConfig(parsed.data)
  }
}
