import type { EventItem } from '../domain/event-item.entity.js'
import { type EventItemWhen, whenOf } from '../domain/schedule.js'

/** An Event item as a write returns it: with when it starts, in its place's zone or else the Event's. */
export interface EventItemView {
  item: EventItem
  when: EventItemWhen | null
}

export function itemViewOf(item: EventItem, eventTimezone: string): EventItemView {
  return { item, when: whenOf(item.snapshot(), eventTimezone) }
}
