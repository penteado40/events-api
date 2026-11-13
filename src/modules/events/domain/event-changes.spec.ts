import { describe, expect, it } from 'vitest'
import { type EventSnapshot, eventChanges } from './event-changes.js'

const STAMP = { by: 7, at: new Date('2026-11-13T15:00:00.000Z') }

const BEFORE: EventSnapshot = {
  name: 'Show em Manaus',
  place: 'Manaus - AM',
  period: { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' },
  state: 'DRAFT',
  reach: [2, 3, 7],
}

describe('eventChanges', () => {
  it('gives one Change for an attribute that changed, with its Author, instant, before and after', () => {
    const changes = eventChanges(BEFORE, { ...BEFORE, name: 'Shows em Manaus' }, STAMP)

    expect(changes).toEqual([
      {
        attribute: 'name',
        before: 'Show em Manaus',
        after: 'Shows em Manaus',
        productionOnly: false,
        reachBefore: [2, 3, 7],
        reachAfter: [2, 3, 7],
        by: 7,
        at: new Date('2026-11-13T15:00:00.000Z'),
      },
    ])
  })

  it('gives no Change when nothing changed', () => {
    expect(eventChanges(BEFORE, { ...BEFORE, reach: [2, 3, 7] }, STAMP)).toEqual([])
  })

  it('treats the period as one attribute, changed when only its zone changes', () => {
    const after = { ...BEFORE, period: { ...BEFORE.period, timezone: 'America/Sao_Paulo' } }

    const changes = eventChanges(BEFORE, after, STAMP)

    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      attribute: 'period',
      before: { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' },
      after: { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Sao_Paulo' },
    })
  })

  it('gives one Change per attribute when several change at once, in a fixed order', () => {
    const after: EventSnapshot = {
      ...BEFORE,
      place: 'Teatro Amazonas',
      name: 'Turnê Norte',
      period: { startDate: '2026-11-12', endDate: '2026-11-16', timezone: 'America/Manaus' },
    }

    const changes = eventChanges(BEFORE, after, STAMP)

    expect(changes.map((c) => [c.attribute, c.before, c.after])).toEqual([
      ['name', 'Show em Manaus', 'Turnê Norte'],
      ['place', 'Manaus - AM', 'Teatro Amazonas'],
      [
        'period',
        { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' },
        { startDate: '2026-11-12', endDate: '2026-11-16', timezone: 'America/Manaus' },
      ],
    ])
  })

  it('keeps the reach of before and of after apart, as given', () => {
    const changes = eventChanges(BEFORE, { ...BEFORE, name: 'Turnê', reach: [2, 7] }, STAMP)

    expect(changes[0]).toMatchObject({ reachBefore: [2, 3, 7], reachAfter: [2, 7] })
  })

  it('records a write made by no User with a null Author', () => {
    const changes = eventChanges(BEFORE, { ...BEFORE, name: 'Turnê' }, { ...STAMP, by: null })

    expect(changes[0]?.by).toBeNull()
  })
})
