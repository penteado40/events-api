import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createEvent } from './support/factories.js'

describe('CORS', () => {
  let t: TestApp
  let eventId: number

  beforeAll(async () => {
    t = await createTestApp({ env: { CORS_ORIGINS: 'https://painel.com' } })
    eventId = (await createEvent({ siteUrl: 'https://festa-da-ana.com' })).id
    await createEvent({ siteUrl: 'https://festa-encerrada.com', status: 'ARCHIVED' })
  })

  afterAll(() => t.close())

  const read = (origin: string) =>
    t.http().get(`/api/v1/events/${eventId}/public`).set('Origin', origin)

  const preflight = (origin: string) =>
    t
      .http()
      .options(`/api/v1/events/${eventId}/public`)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-api-key')

  it('answers the preflight of an Event siteUrl with the allowed headers, cached for 10 min', async () => {
    const res = await preflight('https://festa-da-ana.com')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('https://festa-da-ana.com')
    expect(res.headers['access-control-allow-headers']).toBe('Authorization,X-Api-Key,Content-Type')
    expect(res.headers['access-control-max-age']).toBe('600')
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it.each([
    ['the siteUrl of an active Event', 'https://festa-da-ana.com'],
    ['the siteUrl of an archived Event', 'https://festa-encerrada.com'],
    ['an origin from CORS_ORIGINS', 'https://painel.com'],
    ['localhost outside production', 'http://localhost:5173'],
  ])('lets the browser read the response for %s', async (_case, origin) => {
    const res = await read(origin)

    expect(res.headers['access-control-allow-origin']).toBe(origin)
    expect(res.headers.vary).toMatch(/Origin/)
  })

  it('gives an unknown origin no CORS headers, and still answers the request', async () => {
    const res = await read('https://festa-do-bruno.com')

    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers.vary).toMatch(/Origin/)
    expect(res.status).toBe(401)
  })
})
