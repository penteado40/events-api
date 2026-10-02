import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../shared/application/testing/fixed-clock.js'
import { SiteUrl } from '../domain/site-url.vo.js'
import { CorsOrigins } from './cors-origins.js'
import { newEventProps, SUPER_ADMIN_STAMP } from './testing/event-fixtures.js'
import { InMemoryEventRepository } from './testing/in-memory-event.repository.js'

/** An Event repository whose `listSiteUrls` can fail or hang, as a database outage would. */
class FlakyEventRepository extends InMemoryEventRepository {
  database: 'up' | 'down' | 'hanging' = 'up'

  override listSiteUrls(): Promise<string[]> {
    if (this.database === 'down') return Promise.reject(new Error('database unavailable'))
    if (this.database === 'hanging') return new Promise(() => {})
    return super.listSiteUrls()
  }
}

/** Lets a reload started in the background finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('CorsOrigins', () => {
  let events: FlakyEventRepository
  let clock: FixedClock

  beforeEach(() => {
    events = new FlakyEventRepository()
    clock = new FixedClock(new Date('2026-10-02T12:00:00.000Z'))
  })

  const corsOrigins = (extraOrigins: string[] = []) =>
    new CorsOrigins(events, clock, { extraOrigins })

  const createEvent = (siteUrl: string) =>
    events.create(newEventProps({ siteUrl: SiteUrl.restore(siteUrl) }), null, SUPER_ADMIN_STAMP)

  it('accepts the siteUrl of an active Event', async () => {
    await createEvent('https://festa-da-ana.com')

    expect(await corsOrigins().isAllowed('https://festa-da-ana.com')).toBe(true)
  })

  it('accepts the siteUrl of an archived Event, whose Site still reads (ADR-0011)', async () => {
    const event = await createEvent('https://festa-da-ana.com')
    event.archive(SUPER_ADMIN_STAMP)
    await events.save(event)

    expect(await corsOrigins().isAllowed('https://festa-da-ana.com')).toBe(true)
  })

  it('accepts the extra origins, even with no Event', async () => {
    expect(await corsOrigins(['https://painel.com']).isAllowed('https://painel.com')).toBe(true)
  })

  it('refuses an origin that is neither a siteUrl nor an extra one', async () => {
    await createEvent('https://festa-da-ana.com')

    expect(await corsOrigins(['https://painel.com']).isAllowed('https://festa-do-bruno.com')).toBe(
      false,
    )
  })

  describe('cache', () => {
    const later = (seconds: number) => new Date(clock.now().getTime() + seconds * 1000)

    it('keeps the loaded siteUrls for 60 s, then reloads them in the background', async () => {
      const origins = corsOrigins()
      await origins.isAllowed('https://festa-da-ana.com')
      await createEvent('https://festa-da-ana.com')

      clock.set(later(59))
      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(false)

      clock.set(later(1))
      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(false)
      await settle()
      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(true)
    })

    it('drops a changed siteUrl once the 60 s are over', async () => {
      const event = await createEvent('https://festa-da-ana.com')
      const origins = corsOrigins()
      await origins.isAllowed('https://festa-da-ana.com')
      event.update({ siteUrl: SiteUrl.restore('https://ana-e-bia.com') }, SUPER_ADMIN_STAMP)
      await events.save(event)

      clock.set(later(60))
      await origins.isAllowed('https://festa-da-ana.com')
      await settle()

      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(false)
      expect(await origins.isAllowed('https://ana-e-bia.com')).toBe(true)
    })

    it('never waits for a reload while it has a list, even if the database hangs', async () => {
      await createEvent('https://festa-da-ana.com')
      const origins = corsOrigins()
      await origins.isAllowed('https://festa-da-ana.com')

      clock.set(later(60))
      events.database = 'hanging'

      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(true)
      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(true)
    })

    it('keeps the last good list when a reload fails, and retries after 5 s', async () => {
      await createEvent('https://festa-da-ana.com')
      const origins = corsOrigins()
      await origins.isAllowed('https://festa-da-ana.com')
      await createEvent('https://festa-do-bruno.com')

      clock.set(later(60))
      events.database = 'down'
      await origins.isAllowed('https://festa-da-ana.com')
      await settle()
      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(true)
      expect(await origins.isAllowed('https://festa-do-bruno.com')).toBe(false)

      events.database = 'up'
      clock.set(later(4))
      await origins.isAllowed('https://festa-do-bruno.com')
      await settle()
      expect(await origins.isAllowed('https://festa-do-bruno.com')).toBe(false)

      clock.set(later(1))
      await origins.isAllowed('https://festa-do-bruno.com')
      await settle()
      expect(await origins.isAllowed('https://festa-do-bruno.com')).toBe(true)
    })

    it('waits for the first load, and accepts only the extra origins while it fails', async () => {
      await createEvent('https://festa-da-ana.com')
      events.database = 'down'
      const origins = corsOrigins(['https://painel.com'])

      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(false)
      expect(await origins.isAllowed('https://painel.com')).toBe(true)

      events.database = 'up'
      clock.set(later(5))
      expect(await origins.isAllowed('https://festa-da-ana.com')).toBe(true)
    })
  })
})
