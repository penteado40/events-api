import { describe, expect, it } from 'vitest'
import type { GroupMemberRole } from './event-access-policy.js'
import { eventItemChanges } from './event-item-changes.js'
import type { ItemReachContext } from './event-item-reach.js'
import type { EventItemSnapshot } from './event-item.entity.js'

const SOUNDCHECK: EventItemSnapshot = {
  id: 9,
  name: 'Passagem de som',
  date: '2026-11-14',
  time: '15:00',
  place: null,
  state: 'PUBLISHED',
  position: 9,
  audience: { kind: 'ALL' },
}

const MEMBERS: GroupMemberRole[] = [
  { userId: 2, role: 'OWNER' },
  { userId: 3, role: 'VIEWER' },
  { userId: 7, role: 'OWNER' },
]

/** A published Event where the Viewer 3 is a Participant, and so is reached by the published items. */
const PEOPLE: ItemReachContext = {
  event: { state: 'PUBLISHED', cancelledFrom: null },
  members: MEMBERS,
  participants: [2, 3],
}

describe('eventItemChanges', () => {
  it('gives one Change for the time that changed, with its before, after and the reach of the reach rule', () => {
    const changes = eventItemChanges(SOUNDCHECK, { ...SOUNDCHECK, time: '16:00' }, PEOPLE)

    expect(changes).toEqual([
      {
        eventItemId: 9,
        attribute: 'time',
        before: '15:00',
        after: '16:00',
        productionOnly: false,
        reachBefore: [2, 3, 7],
        reachAfter: [2, 3, 7],
      },
    ])
  })

  it('gives one Change of the item on its creation, reaching no one before it', () => {
    const created = {
      ...SOUNDCHECK,
      place: { name: 'Teatro Amazonas', address: null, timezone: null },
    }

    expect(eventItemChanges(null, created, PEOPLE)).toEqual([
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
        reachAfter: [2, 3, 7],
      },
    ])
  })

  it('gives one Change of the item on its removal, reaching no one after it', () => {
    expect(eventItemChanges(SOUNDCHECK, null, PEOPLE)).toEqual([
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
        reachBefore: [2, 3, 7],
        reachAfter: [],
      }),
    ])
  })

  it('gives no Change when nothing changed', () => {
    expect(eventItemChanges(SOUNDCHECK, { ...SOUNDCHECK }, PEOPLE)).toEqual([])
  })

  it('gives one Change per attribute when several change at once, in a fixed order', () => {
    const after: EventItemSnapshot = {
      ...SOUNDCHECK,
      place: { name: 'Teatro Amazonas', address: null, timezone: 'America/Manaus' },
      time: null,
      name: 'Passagem de som (banda)',
      date: '2026-11-15',
    }

    const changes = eventItemChanges(SOUNDCHECK, after, PEOPLE)

    expect(changes.map((c) => [c.attribute, c.before, c.after])).toEqual([
      ['name', 'Passagem de som', 'Passagem de som (banda)'],
      ['date', '2026-11-14', '2026-11-15'],
      ['time', '15:00', null],
      ['place', null, { name: 'Teatro Amazonas', address: null, timezone: 'America/Manaus' }],
    ])
  })

  it('gives one Change of the state when a Draft is published, reaching the Owners before and the Participants too after', () => {
    const draft: EventItemSnapshot = { ...SOUNDCHECK, state: 'DRAFT' }

    expect(eventItemChanges(draft, SOUNDCHECK, PEOPLE)).toEqual([
      {
        eventItemId: 9,
        attribute: 'state',
        before: 'DRAFT',
        after: 'PUBLISHED',
        productionOnly: false,
        reachBefore: [2, 7],
        reachAfter: [2, 3, 7],
      },
    ])
  })

  it('gives one Change of the Audience, only for the production, with the reach of before and of after', () => {
    // Members 2 and 7 are Owners; 3 is a Viewer Participant, reached by "Todos" and not once left off the list.
    const chosen: EventItemSnapshot = {
      ...SOUNDCHECK,
      audience: { kind: 'SELECTED', userIds: [2] },
    }

    expect(eventItemChanges(SOUNDCHECK, chosen, PEOPLE)).toEqual([
      {
        eventItemId: 9,
        attribute: 'audience',
        before: { kind: 'ALL' },
        after: { kind: 'SELECTED', userIds: [2] },
        productionOnly: true,
        reachBefore: [2, 3, 7],
        reachAfter: [2, 7],
      },
    ])
  })

  it('gives no Change of the Audience when the same people are chosen again', () => {
    const chosen: EventItemSnapshot = {
      ...SOUNDCHECK,
      audience: { kind: 'SELECTED', userIds: [3] },
    }

    expect(
      eventItemChanges(chosen, { ...chosen, audience: { kind: 'SELECTED', userIds: [3] } }, PEOPLE),
    ).toEqual([])
  })

  it('keeps the Audience out of the Change of a creation, which everyone it reaches sees', () => {
    const [created] = eventItemChanges(null, SOUNDCHECK, PEOPLE)

    expect(created?.after).not.toHaveProperty('audience')
  })

  it('treats the place as one attribute, changed when only its zone changes', () => {
    const place = { name: 'Teatro Amazonas', address: null, timezone: null }
    const before = { ...SOUNDCHECK, place }

    const changes = eventItemChanges(
      before,
      { ...before, place: { ...place, timezone: 'America/Manaus' } },
      PEOPLE,
    )

    expect(changes.map((c) => c.attribute)).toEqual(['place'])
    expect(eventItemChanges(before, { ...before, place: { ...place } }, PEOPLE)).toEqual([])
  })

  it('reaches only the Owners in an Event in Draft, and no Viewer who is not a Participant', () => {
    const rename = { ...SOUNDCHECK, name: 'Som' }

    expect(
      eventItemChanges(SOUNDCHECK, rename, {
        ...PEOPLE,
        event: { state: 'DRAFT', cancelledFrom: null },
      })[0],
    ).toMatchObject({ reachBefore: [2, 7], reachAfter: [2, 7] })
    expect(eventItemChanges(SOUNDCHECK, rename, { ...PEOPLE, participants: [] })[0]).toMatchObject({
      reachBefore: [2, 7],
      reachAfter: [2, 7],
    })
  })
})
