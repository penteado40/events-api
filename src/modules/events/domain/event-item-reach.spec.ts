import { describe, expect, it } from 'vitest'
import type { EventItemAudienceValues } from './event-item-audience.vo.js'
import type { EventItemSnapshot, EventItemState } from './event-item.entity.js'
import { eventItemReach, eventItemReaches, type ReachEvent } from './event-item-reach.js'

function item(
  state: EventItemState,
  audience: EventItemAudienceValues = { kind: 'ALL' },
): EventItemSnapshot {
  return { id: 1, name: 'Show', date: null, time: null, place: null, state, position: 1, audience }
}

const PUBLISHED: ReachEvent = { state: 'PUBLISHED', cancelledFrom: null }
const DRAFT: ReachEvent = { state: 'DRAFT', cancelledFrom: null }

const OWNER = { userId: 10, production: true, participant: false }
const VIEWER_PARTICIPANT = { userId: 11, production: false, participant: true }
const VIEWER_NOT_PARTICIPANT = { userId: 12, production: false, participant: false }

describe('eventItemReaches', () => {
  it('reaches the production with every item, Draft included, in an Event in Draft too', () => {
    for (const state of ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const) {
      expect(eventItemReaches(item(state), DRAFT, OWNER)).toBe(true)
      expect(eventItemReaches(item(state), PUBLISHED, OWNER)).toBe(true)
    }
  })

  it('reaches a Viewer Participant with a published item of a published Event', () => {
    expect(eventItemReaches(item('PUBLISHED'), PUBLISHED, VIEWER_PARTICIPANT)).toBe(true)
  })

  it('reaches a Viewer Participant with a Cancelled item of a published Event, shown with its seal', () => {
    expect(eventItemReaches(item('CANCELLED'), PUBLISHED, VIEWER_PARTICIPANT)).toBe(true)
  })

  it('never reaches a Viewer with an item in Draft', () => {
    expect(eventItemReaches(item('DRAFT'), PUBLISHED, VIEWER_PARTICIPANT)).toBe(false)
  })

  it('reaches no Viewer with any item of an Event in Draft', () => {
    expect(eventItemReaches(item('PUBLISHED'), DRAFT, VIEWER_PARTICIPANT)).toBe(false)
  })

  it('never reaches a Viewer who is not a Participant', () => {
    expect(eventItemReaches(item('PUBLISHED'), PUBLISHED, VIEWER_NOT_PARTICIPANT)).toBe(false)
    expect(eventItemReaches(item('CANCELLED'), PUBLISHED, VIEWER_NOT_PARTICIPANT)).toBe(false)
  })

  it('keeps reaching the Participants in a Cancelled Event that had been published, and not in one cancelled from Draft', () => {
    const cancelledPublished: ReachEvent = { state: 'CANCELLED', cancelledFrom: 'PUBLISHED' }
    const cancelledDraft: ReachEvent = { state: 'CANCELLED', cancelledFrom: 'DRAFT' }

    expect(eventItemReaches(item('PUBLISHED'), cancelledPublished, VIEWER_PARTICIPANT)).toBe(true)
    expect(eventItemReaches(item('PUBLISHED'), cancelledDraft, VIEWER_PARTICIPANT)).toBe(false)
  })
})

describe('eventItemReaches with the Audience chosen', () => {
  const chosen = (...userIds: number[]): EventItemAudienceValues => ({ kind: 'SELECTED', userIds })

  it('reaches a Viewer Participant on the list', () => {
    expect(eventItemReaches(item('PUBLISHED', chosen(11)), PUBLISHED, VIEWER_PARTICIPANT)).toBe(
      true,
    )
  })

  it('never reaches a Viewer Participant left off the list', () => {
    expect(eventItemReaches(item('PUBLISHED', chosen(13)), PUBLISHED, VIEWER_PARTICIPANT)).toBe(
      false,
    )
    expect(eventItemReaches(item('CANCELLED', chosen()), PUBLISHED, VIEWER_PARTICIPANT)).toBe(false)
  })

  it('still reaches the production, on the list or not', () => {
    expect(eventItemReaches(item('PUBLISHED', chosen(11)), PUBLISHED, OWNER)).toBe(true)
    expect(eventItemReaches(item('DRAFT', chosen()), DRAFT, OWNER)).toBe(true)
  })

  it('keeps Draft and an Event in Draft from a Viewer on the list', () => {
    expect(eventItemReaches(item('DRAFT', chosen(11)), PUBLISHED, VIEWER_PARTICIPANT)).toBe(false)
    expect(eventItemReaches(item('PUBLISHED', chosen(11)), DRAFT, VIEWER_PARTICIPANT)).toBe(false)
  })
})

describe('eventItemReach', () => {
  const members = [
    { userId: 10, role: 'OWNER' as const },
    { userId: 11, role: 'VIEWER' as const },
    { userId: 12, role: 'VIEWER' as const },
  ]

  it('lists the Owners and the Viewers it reaches, in the order of the members given', () => {
    expect(
      eventItemReach(item('PUBLISHED'), { event: PUBLISHED, members, participants: [11, 10] }),
    ).toEqual([10, 11])
  })

  it('lists only the Owners for an item in Draft, even when they are not Participants', () => {
    expect(
      eventItemReach(item('DRAFT'), { event: PUBLISHED, members, participants: [11, 12] }),
    ).toEqual([10])
  })

  it('lists the Owners and only the Viewers chosen, for an item with the Audience chosen', () => {
    expect(
      eventItemReach(item('PUBLISHED', { kind: 'SELECTED', userIds: [12] }), {
        event: PUBLISHED,
        members,
        participants: [10, 11, 12],
      }),
    ).toEqual([10, 12])
  })

  it('reaches no one with an item that does not exist', () => {
    expect(eventItemReach(null, { event: PUBLISHED, members, participants: [10, 11, 12] })).toEqual(
      [],
    )
  })
})
