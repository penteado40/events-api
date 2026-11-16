import type { EventItemPlaceValues } from './event-item-place.vo.js'
import type { EventItemSnapshot, EventItemState } from './event-item.entity.js'
import { byOrderOfTheProduction } from './event-item-order.js'
import type { FieldSnapshot } from './field.entity.js'

/** When an Event item starts, as it travels: never converted, in the zone of its place (ADR-0016). */
export interface EventItemWhen {
  date: string
  time: string | null
  timezone: string
}

/** A person of a people Field as the schedule shows them: who they are, by name. */
export interface FieldPerson {
  userId: number
  name: string
}

/**
 * A Field as the schedule shows it: its type, name and value, the text of a
 * text Field or the people of a people Field, by name, in their order.
 */
export type ScheduleField = { id: number; name: string } & (
  { kind: 'TEXT'; value: string } | { kind: 'PEOPLE'; value: FieldPerson[] }
)

/**
 * A Field as it is shown, with the names of the people in it (the names
 * given, by User id). A User is never deleted (ADR-0013), so a person always
 * has a name; one missing is left out, never shown without it.
 */
export function showField(field: FieldSnapshot, names: ReadonlyMap<number, string>): ScheduleField {
  const shown = { id: field.id, name: field.name }
  if (field.value.kind === 'TEXT') return { ...shown, kind: 'TEXT', value: field.value.text }
  return {
    ...shown,
    kind: 'PEOPLE',
    value: field.value.userIds.flatMap((userId) => {
      const name = names.get(userId)
      return name === undefined ? [] : [{ userId, name }]
    }),
  }
}

/** An Event item as the schedule shows it. */
export interface ScheduleItem {
  id: number
  name: string
  /** null for an item of the General info. */
  when: EventItemWhen | null
  place: EventItemPlaceValues | null
  state: EventItemState
  /** Its Fields, in the order of the production. */
  fields: ScheduleField[]
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

/**
 * What the schedule is assembled from: the Event's default zone, its items
 * and their Fields, in any order, and the names of the people in them. A
 * Field of an item not given is left out.
 */
export interface ScheduleSource {
  timezone: string
  items: readonly EventItemSnapshot[]
  fields: readonly FieldSnapshot[]
  /** The names of the people in the people Fields, by User id. */
  names: ReadonlyMap<number, string>
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
 * time and, at the same time, in the order of the production). The order of
 * the production is the items' manual position, and the order of creation
 * where two share one; it only breaks ties, never passes over the time. The
 * day of an item is its calendar date, with no exception: the 00:40 transfer
 * after Saturday's show is Sunday's. Each item brings its Fields, in the
 * order of the production, the people of a people Field by name. Pure (ADR-0019).
 */
export function assembleSchedule(source: ScheduleSource): Schedule {
  const fieldsByItem = new Map<number, ScheduleField[]>()
  for (const field of [...source.fields].sort(byOrderOfTheProduction)) {
    const shown = fieldsByItem.get(field.eventItemId) ?? []
    shown.push(showField(field, source.names))
    fieldsByItem.set(field.eventItemId, shown)
  }
  const generalInfo: ScheduleItem[] = []
  const days = new Map<string, ScheduleItem[]>()
  // In the order of the production first: the stable sorts below keep it in every tie.
  for (const item of [...source.items].sort(byOrderOfTheProduction)) {
    const shown: ScheduleItem = {
      id: item.id,
      name: item.name,
      when: whenOf(item, source.timezone),
      place: item.place === null ? null : { ...item.place },
      state: item.state,
      fields: fieldsByItem.get(item.id) ?? [],
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
