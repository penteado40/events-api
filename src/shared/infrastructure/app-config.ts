import { z } from 'zod'

/** An origin written exactly as a browser sends it: scheme + host + port, no path, no wildcard. */
function isExactOrigin(value: string): boolean {
  try {
    return !value.includes('*') && new URL(value).origin === value
  } catch {
    return false
  }
}

const UPSTASH_VARS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
    /** Activation link lifetime, in seconds (default 7 days). */
    ACTIVATION_LINK_TTL: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60),
    DOCS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** Comma-separated origins CORS accepts besides the Events' siteUrls (e.g. the Panel). */
    CORS_ORIGINS: z
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
          z
            .string()
            .refine(isExactOrigin, 'cada origem precisa ser exata, ex.: https://painel.com'),
        ),
      ),
    /** Rate-limit counters (ADR-0007). Required in production; without them, counters stay in memory. */
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    /** Set by Vercel: `1` on its functions, and `production` | `preview` | `development`. */
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
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
  readonly jwtSecret: string
  readonly docsEnabled: boolean
  readonly activationLinkTtlSeconds: number
  readonly corsOrigins: string[]
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
    this.jwtSecret = env.JWT_SECRET
    this.docsEnabled = env.DOCS_ENABLED
    this.activationLinkTtlSeconds = env.ACTIVATION_LINK_TTL
    this.corsOrigins = env.CORS_ORIGINS
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
