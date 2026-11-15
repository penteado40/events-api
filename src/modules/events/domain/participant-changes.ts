import type { NewChange } from './change.js'

/**
 * The Change of a User entering the list of Participants of the Event
 * (attribute `participant`, before null and after the User id). Only the
 * production sees it (CONTEXT.md, Change log); its reach, as on every Change
 * of the Event, is every Group member given (eventReach).
 */
export function participantJoined(userId: number, reach: readonly number[]): NewChange {
  return participantChange(null, userId, reach)
}

/** The Change of a User leaving the list of Participants: before the User id, after null. */
export function participantLeft(userId: number, reach: readonly number[]): NewChange {
  return participantChange(userId, null, reach)
}

function participantChange(
  before: number | null,
  after: number | null,
  reach: readonly number[],
): NewChange {
  return {
    eventItemId: null,
    attribute: 'participant',
    before,
    after,
    productionOnly: true,
    reachBefore: [...reach],
    reachAfter: [...reach],
  }
}
