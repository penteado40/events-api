import { describe, expect, it } from 'vitest'
import { AppConfig } from './app-config.js'

const REQUIRED = {
  DATABASE_URL: 'postgresql://localhost/events',
  JWT_SECRET: 'x'.repeat(32),
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
