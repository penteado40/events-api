import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
  DOCS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

/** Typed, validated environment. Also the injection token for configuration. */
export class AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly port: number
  readonly databaseUrl: string
  readonly jwtSecret: string
  readonly docsEnabled: boolean

  private constructor(env: z.output<typeof EnvSchema>) {
    this.nodeEnv = env.NODE_ENV
    this.port = env.PORT
    this.databaseUrl = env.DATABASE_URL
    this.jwtSecret = env.JWT_SECRET
    this.docsEnabled = env.DOCS_ENABLED
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
