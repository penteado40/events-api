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
