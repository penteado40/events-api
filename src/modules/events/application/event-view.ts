import type { Event } from '../domain/event.entity.js'

/** An Event as it reads at an instant: with whether it is a Finished event then. */
export interface EventView {
  event: Event
  isFinished: boolean
}

export function viewOf(event: Event, now: Date): EventView {
  return { event, isFinished: event.isFinished(now) }
}
