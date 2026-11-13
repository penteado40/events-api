import { describe, expect, it } from 'vitest'
import type { GroupMemberRole } from './event-access-policy.js'
import { eventItemChanges } from './event-item-changes.js'
import type { EventItemSnapshot } from './event-item.entity.js'

const SOUNDCHECK: EventItemSnapshot = {
  id: 9,
  name: 'Passagem de som',
  date: '2026-11-14',
  time: '15:00',
  place: null,
  state: 'PUBLISHED',
}

const MEMBERS: GroupMemberRole[] = [
  { userId: 2, role: 'OWNER' },
  { userId: 3, role: 'VIEWER' },
  { userId: 7, role: 'OWNER' },
]

describe('eventItemChanges', () => {
  it('gives one Change for the time that changed, with its before, after and the Owners as reach', () => {
    const changes = eventItemChanges(SOUNDCHECK, { ...SOUNDCHECK, time: '16:00' }, MEMBERS)

    expect(changes).toEqual([
      {
        eventItemId: 9,
        attribute: 'time',
        before: '15:00',
        after: '16:00',
        productionOnly: false,
        reachBefore: [2, 7],
        reachAfter: [2, 7],
      },
    ])
  })

  it('gives one Change of the item on its creation, reaching no one before it', () => {
    const created = {
      ...SOUNDCHECK,
      place: { name: 'Teatro Amazonas', address: null, timezone: null },
    }

    expect(eventItemChanges(null, created, MEMBERS)).toEqual([
      {
        eventItemId: 9,
        attribute: 'item',
        before: null,
        after: {
          name: 'Passagem de som',
          date: '2026-11-14',
          time: '15:00',
          place: { name: 'Teatro Amazonas', address: null, timezone: null },
          state: 'PUBLISHED',
        },
        productionOnly: false,
        reachBefore: [],
        reachAfter: [2, 7],
      },
    ])
  })

  it('gives one Change of the item on its removal, reaching no one after it', () => {
    expect(eventItemChanges(SOUNDCHECK, null, MEMBERS)).toEqual([
      expect.objectContaining({
        eventItemId: 9,
        attribute: 'item',
        before: {
          name: 'Passagem de som',
          date: '2026-11-14',
          time: '15:00',
          place: null,
          state: 'PUBLISHED',
        },
        after: null,
        reachBefore: [2, 7],
        reachAfter: [],
      }),
    ])
  })

  it('gives no Change when nothing changed', () => {
    expect(eventItemChanges(SOUNDCHECK, { ...SOUNDCHECK }, MEMBERS)).toEqual([])
  })

  it('gives one Change per attribute when several change at once, in a fixed order', () => {
    const after: EventItemSnapshot = {
      ...SOUNDCHECK,
      place: { name: 'Teatro Amazonas', address: null, timezone: 'America/Manaus' },
      time: null,
      name: 'Passagem de som (banda)',
      date: '2026-11-15',
    }

    const changes = eventItemChanges(SOUNDCHECK, after, MEMBERS)

    expect(changes.map((c) => [c.attribute, c.before, c.after])).toEqual([
      ['name', 'Passagem de som', 'Passagem de som (banda)'],
      ['date', '2026-11-14', '2026-11-15'],
      ['time', '15:00', null],
      ['place', null, { name: 'Teatro Amazonas', address: null, timezone: 'America/Manaus' }],
    ])
  })

  it('treats the place as one attribute, changed when only its zone changes', () => {
    const place = { name: 'Teatro Amazonas', address: null, timezone: null }
    const before = { ...SOUNDCHECK, place }

    const changes = eventItemChanges(
      before,
      { ...before, place: { ...place, timezone: 'America/Manaus' } },
      MEMBERS,
    )

    expect(changes.map((c) => c.attribute)).toEqual(['place'])
    expect(eventItemChanges(before, { ...before, place: { ...place } }, MEMBERS)).toEqual([])
  })

  it('reaches no one when the Group has no Owner', () => {
    const changes = eventItemChanges(SOUNDCHECK, { ...SOUNDCHECK, name: 'Som' }, [
      { userId: 3, role: 'VIEWER' },
    ])

    expect(changes[0]).toMatchObject({ reachBefore: [], reachAfter: [] })
  })
})
