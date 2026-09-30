import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { NewEventProps } from '../../domain/event.entity.js'
import { SiteUrl } from '../../domain/site-url.vo.js'
import { Slug } from '../../domain/slug.vo.js'

/** A write by the Super admin (id 1), for arranging state where the Author does not matter. */
export const SUPER_ADMIN_STAMP: Stamp = { by: 1, at: new Date('2026-09-01T12:00:00.000Z') }

let sequence = 0

/** Valid props for a new Event; each call gets its own slug. */
export function newEventProps(overrides: Partial<NewEventProps> = {}): NewEventProps {
  sequence += 1
  return {
    type: 'WEDDING',
    name: `Evento ${sequence}`,
    slug: Slug.create(`evento-${sequence}`),
    siteUrl: SiteUrl.restore('https://evento.com'),
    startsAt: new Date('2026-11-14T22:00:00.000Z'),
    endsAt: null,
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    currency: 'BRL',
    venueName: null,
    venueAddress: null,
    city: null,
    mapsUrl: null,
    ...overrides,
  }
}
