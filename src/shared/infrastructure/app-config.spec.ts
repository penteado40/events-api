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
      AppConfig.fromEnv({ ...REQUIRED, ...UPSTASH, NODE_ENV: 'production' }).upstash,
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
