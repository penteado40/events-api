import { describe, expect, it } from 'vitest'
import type { EventItemSnapshot, EventItemState } from './event-item.entity.js'
import { eventItemReach, eventItemReaches, type ReachEvent } from './event-item-reach.js'

function item(state: EventItemState): EventItemSnapshot {
  return { id: 1, name: 'Show', date: null, time: null, place: null, state, position: 1 }
}

const PUBLISHED: ReachEvent = { state: 'PUBLISHED', cancelledFrom: null }
const DRAFT: ReachEvent = { state: 'DRAFT', cancelledFrom: null }

const OWNER = { production: true, participant: false }
const VIEWER_PARTICIPANT = { production: false, participant: true }
const VIEWER_NOT_PARTICIPANT = { production: false, participant: false }

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

describe('eventItemReach', () => {
  const members = [
    { userId: 10, role: 'OWNER' as const },
    { userId: 11, role: 'VIEWER' as const },
    { userId: 12, role: 'VIEWER' as const },
  ]

  it('lists the Owners and the Viewers it reaches, in the order of the members given', () => {
    expect(eventItemReach(item('PUBLISHED'), PUBLISHED, members, [11, 10])).toEqual([10, 11])
  })

  it('lists only the Owners for an item in Draft, even when they are not Participants', () => {
    expect(eventItemReach(item('DRAFT'), PUBLISHED, members, [11, 12])).toEqual([10])
  })

  it('reaches no one with an item that does not exist', () => {
    expect(eventItemReach(null, PUBLISHED, members, [10, 11, 12])).toEqual([])
  })
})
