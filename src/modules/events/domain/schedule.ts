import type { EventItemPlaceValues } from './event-item-place.vo.js'
import type { EventItemSnapshot, EventItemState } from './event-item.entity.js'

/** When an Event item starts, as it travels: never converted, in the zone of its place (ADR-0016). */
export interface EventItemWhen {
  date: string
  time: string | null
  timezone: string
}

/** An Event item as the schedule shows it. */
export interface ScheduleItem {
  id: number
  name: string
  /** null for an item of the General info. */
  when: EventItemWhen | null
  place: EventItemPlaceValues | null
  state: EventItemState
}

/** One day of the Timeline: only a date and its items, with no title or state of its own. */
export interface TimelineDay {
  date: string
  items: ScheduleItem[]
}

export interface Schedule {
  generalInfo: ScheduleItem[]
  timeline: TimelineDay[]
}

/** What the schedule is assembled from: the Event's default zone and its items, in the order of the production. */
export interface ScheduleSource {
  timezone: string
  items: readonly EventItemSnapshot[]
}

/**
 * When the item starts, in the zone of its place, or else the Event's default
 * zone; null when it has no date.
 */
export function whenOf(item: EventItemSnapshot, eventTimezone: string): EventItemWhen | null {
  if (item.date === null) return null
  return { date: item.date, time: item.time, timezone: item.place?.timezone ?? eventTimezone }
}

/**
 * The schedule of an Event (CONTEXT.md): the General info (the items with no
 * date, in the order of the production) and the Timeline (only the days with
 * items, in date order, those outside the period included; on each day, first
 * the items with no time, in the order of the production, then the others by
 * time). The day of an item is its calendar date, with no exception: the 00:40
 * transfer after Saturday's show is Sunday's. Pure (ADR-0019).
 */
export function assembleSchedule(source: ScheduleSource): Schedule {
  const generalInfo: ScheduleItem[] = []
  const days = new Map<string, ScheduleItem[]>()
  for (const item of source.items) {
    const shown: ScheduleItem = {
      id: item.id,
      name: item.name,
      when: whenOf(item, source.timezone),
      place: item.place === null ? null : { ...item.place },
      state: item.state,
    }
    if (shown.when === null) {
      generalInfo.push(shown)
    } else {
      const day = days.get(shown.when.date) ?? []
      day.push(shown)
      days.set(shown.when.date, day)
    }
  }
  const timeline = [...days.entries()]
    // Zero-padded `YYYY-MM-DD` orders like the calendar, and so does `HH:mm`.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items: items.sort(byTimeUntimedFirst) }))
  return { generalInfo, timeline }
}

/** Items with no time first; then by time. Ties keep the order of the production (the sort is stable). */
function byTimeUntimedFirst(a: ScheduleItem, b: ScheduleItem): number {
  const timeA = a.when?.time ?? null
  const timeB = b.when?.time ?? null
  if (timeA === timeB) return 0
  if (timeA === null) return -1
  if (timeB === null) return 1
  return timeA.localeCompare(timeB)
}
