import { describe, expect, it } from 'vitest'
import { AppConfig } from './app-config.js'

const REQUIRED = {
  DATABASE_URL: 'postgresql://localhost/events',
}

describe('AppConfig: CORS_ORIGINS', () => {
  it('is empty when unset or blank', () => {
    expect(AppConfig.fromEnv(REQUIRED).corsOrigins).toEqual([])
    expect(AppConfig.fromEnv({ ...REQUIRED, CORS_ORIGINS: ' ' }).corsOrigins).toEqual([])
  })

  it('reads a comma-separated list of exact origins', () => {
    const config = AppConfig.fromEnv({
      ...REQUIRED,
      CORS_ORIGINS: 'https://painel.com, http://localhost:5173',
    })

    expect(config.corsOrigins).toEqual(['https://painel.com', 'http://localhost:5173'])
  })

  it('refuses anything that is not an exact origin', () => {
    for (const value of [
      'painel.com',
      'https://painel.com/',
      'https://painel.com/app',
      'https://*.vercel.app',
      'HTTPS://Painel.com',
    ]) {
      expect(() => AppConfig.fromEnv({ ...REQUIRED, CORS_ORIGINS: value }), value).toThrow(
        /CORS_ORIGINS/,
      )
    }
  })
})

describe('AppConfig: Upstash', () => {
  const UPSTASH = {
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token',
  }

  it('is optional outside production, where the counters stay in memory', () => {
    expect(AppConfig.fromEnv(REQUIRED).upstash).toBeNull()
  })

  it('reads the URL and the token when both are set', () => {
    expect(AppConfig.fromEnv({ ...REQUIRED, ...UPSTASH }).upstash).toEqual({
      url: 'https://example.upstash.io',
      token: 'token',
    })
  })

  it('refuses one without the other', () => {
    expect(() =>
      AppConfig.fromEnv({ ...REQUIRED, UPSTASH_REDIS_REST_URL: UPSTASH.UPSTASH_REDIS_REST_URL }),
    ).toThrow(/UPSTASH_REDIS_REST_TOKEN/)
    expect(() => AppConfig.fromEnv({ ...REQUIRED, UPSTASH_REDIS_REST_TOKEN: 'token' })).toThrow(
      /UPSTASH_REDIS_REST_URL/,
    )
  })

  it('is required in production, so the limit never falls back to memory in silence', () => {
    expect(() => AppConfig.fromEnv({ ...REQUIRED, NODE_ENV: 'production' })).toThrow(
      /UPSTASH_REDIS_REST_URL/,
    )
    expect(
      AppConfig.fromEnv({
        ...REQUIRED,
        ...UPSTASH,
        CLERK_SECRET_KEY: 'sk_live_x',
        CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_x',
        ACTIVATION_REDIRECT_URL: 'eventsexpo://activate',
        NODE_ENV: 'production',
      }).upstash,
    ).not.toBeNull()
  })

  it('prefixes the keys with the Vercel environment, or "local" outside Vercel', () => {
    expect(AppConfig.fromEnv(REQUIRED).rateLimitPrefix).toBe('events-api:local')
    expect(AppConfig.fromEnv({ ...REQUIRED, VERCEL_ENV: 'preview' }).rateLimitPrefix).toBe(
      'events-api:preview',
    )
  })
})

describe('AppConfig: behindVercelProxy', () => {
  it('is true only when VERCEL=1', () => {
    expect(AppConfig.fromEnv(REQUIRED).behindVercelProxy).toBe(false)
    expect(AppConfig.fromEnv({ ...REQUIRED, VERCEL: '1' }).behindVercelProxy).toBe(true)
  })
})

describe('AppConfig: CLERK_SECRET_KEY', () => {
  it('is optional outside production, where the tests verify tokens with a fake', () => {
    expect(AppConfig.fromEnv(REQUIRED).clerkSecretKey).toBeNull()
    expect(AppConfig.fromEnv({ ...REQUIRED, CLERK_SECRET_KEY: 'sk_test_x' }).clerkSecretKey).toBe(
      'sk_test_x',
    )
  })

  it('is required in production, where every request is verified by Clerk', () => {
    expect(() =>
      AppConfig.fromEnv({
        ...REQUIRED,
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        NODE_ENV: 'production',
      }),
    ).toThrow(/CLERK_SECRET_KEY/)
  })
})

describe('AppConfig: CLERK_WEBHOOK_SIGNING_SECRET', () => {
  it('is optional outside production', () => {
    expect(AppConfig.fromEnv(REQUIRED).clerkWebhookSigningSecret).toBeNull()
    expect(
      AppConfig.fromEnv({ ...REQUIRED, CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_x' })
        .clerkWebhookSigningSecret,
    ).toBe('whsec_x')
  })

  it('is required in production, where the webhook keeps the User mirror in step', () => {
    expect(() =>
      AppConfig.fromEnv({
        ...REQUIRED,
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        CLERK_SECRET_KEY: 'sk_live_x',
        ACTIVATION_REDIRECT_URL: 'eventsexpo://activate',
        NODE_ENV: 'production',
      }),
    ).toThrow(/CLERK_WEBHOOK_SIGNING_SECRET/)
  })
})

describe('AppConfig: Activation link', () => {
  it('lasts 7 days and has no redirect by default', () => {
    const config = AppConfig.fromEnv(REQUIRED)

    expect(config.activationLinkTtlDays).toBe(7)
    expect(config.activationRedirectUrl).toBeNull()
  })

  it("reads the lifetime in days and the app's deep link", () => {
    const config = AppConfig.fromEnv({
      ...REQUIRED,
      ACTIVATION_LINK_TTL_DAYS: '3',
      ACTIVATION_REDIRECT_URL: 'eventsexpo://activate',
    })

    expect(config.activationLinkTtlDays).toBe(3)
    expect(config.activationRedirectUrl).toBe('eventsexpo://activate')
  })

  it('requires the redirect in production, where the link must open the app', () => {
    expect(() =>
      AppConfig.fromEnv({
        ...REQUIRED,
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        CLERK_SECRET_KEY: 'sk_live_x',
        NODE_ENV: 'production',
      }),
    ).toThrow(/ACTIVATION_REDIRECT_URL/)
  })
})

describe('AppConfig: Clerk verification', () => {
  it('has no JWT key and no authorized parties by default', () => {
    const config = AppConfig.fromEnv(REQUIRED)

    expect(config.clerkJwtKey).toBeNull()
    expect(config.clerkAuthorizedParties).toEqual([])
  })

  it('reads the PEM public key and the comma-separated authorized parties', () => {
    const config = AppConfig.fromEnv({
      ...REQUIRED,
      CLERK_JWT_KEY: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
      CLERK_AUTHORIZED_PARTIES: 'https://painel.com, http://localhost:8081',
    })

    expect(config.clerkJwtKey).toContain('BEGIN PUBLIC KEY')
    expect(config.clerkAuthorizedParties).toEqual(['https://painel.com', 'http://localhost:8081'])
  })

  it('refuses an authorized party that is not an exact origin', () => {
    expect(() =>
      AppConfig.fromEnv({ ...REQUIRED, CLERK_AUTHORIZED_PARTIES: 'https://painel.com/' }),
    ).toThrow(/CLERK_AUTHORIZED_PARTIES/)
  })
})

describe('AppConfig: CLERK_PUBLISHABLE_KEY', () => {
  const key = (frontendApi: string, prefix = 'pk_test_') =>
    `${prefix}${Buffer.from(`${frontendApi}$`).toString('base64')}`

  it('is null when unset or blank: the docs then take only a pasted token', () => {
    expect(AppConfig.fromEnv(REQUIRED).clerkDocsLogin).toBeNull()
    expect(AppConfig.fromEnv({ ...REQUIRED, CLERK_PUBLISHABLE_KEY: ' ' }).clerkDocsLogin).toBeNull()
  })

  it('reads the Frontend API host encoded in the key', () => {
    const publishableKey = key('happy-cat-12.clerk.accounts.dev')

    expect(
      AppConfig.fromEnv({ ...REQUIRED, CLERK_PUBLISHABLE_KEY: publishableKey }).clerkDocsLogin,
    ).toEqual({ publishableKey, frontendApi: 'happy-cat-12.clerk.accounts.dev' })
  })

  it('refuses anything that is not a Clerk publishable key', () => {
    for (const value of [
      'sk_test_abc',
      'pk_test_',
      'pk_test_not-base64!',
      key('happy-cat-12.clerk.accounts.dev').slice(0, -4),
      `pk_test_${Buffer.from('evil.com/x$').toString('base64')}`,
    ]) {
      expect(() => AppConfig.fromEnv({ ...REQUIRED, CLERK_PUBLISHABLE_KEY: value }), value).toThrow(
        /CLERK_PUBLISHABLE_KEY/,
      )
    }
  })
})
