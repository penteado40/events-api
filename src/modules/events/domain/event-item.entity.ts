import type { LocalDate } from '../../../shared/domain/local-date.vo.js'
import type { LocalTime } from '../../../shared/domain/local-time.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EventItemName } from './event-item-name.vo.js'
import type { EventItemPlace, EventItemPlaceValues } from './event-item-place.vo.js'
import { EventItemStart } from './event-item-start.vo.js'

/**
 * The state the production moves an Event item through. In an Event in Draft
 * it is born published; Draft and Cancelled come later.
 */
export const EVENT_ITEM_STATES = ['PUBLISHED'] as const
export type EventItemState = (typeof EVENT_ITEM_STATES)[number]

export interface EventItemProps {
  id: number
  eventId: number
  name: string
  start: EventItemStart
  place: EventItemPlace | null
  state: EventItemState
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewEventItemProps {
  eventId: number
  name: EventItemName
  start: EventItemStart
  place: EventItemPlace | null
}

/** What an edit may change; a field left out stays as it is, null clears it. */
export interface EventItemEdit {
  name?: EventItemName
  date?: LocalDate | null
  time?: LocalTime | null
  place?: EventItemPlace | null
}

/**
 * An Event item as plain data (ADR-0019): taken from the entity on a write and
 * loaded as is by the read port of the schedule. No behavior.
 */
export interface EventItemSnapshot {
  id: number
  name: string
  /** `YYYY-MM-DD`; null for an item of the General info. */
  date: string | null
  /** `HH:mm`, only with a date. */
  time: string | null
  /** The place as written; its zone null when the Event's applies. */
  place: EventItemPlaceValues | null
  state: EventItemState
}

/**
 * One piece of the schedule of an Event (CONTEXT.md, Event item): something
 * with a date and time, only a date, or no date (General info). The time is
 * only the start's, always the place's, never converted (ADR-0016).
 */
export class EventItem {
  private constructor(private readonly props: EventItemProps) {}

  static restore(props: EventItemProps): EventItem {
    return new EventItem({ ...props })
  }

  get id(): number {
    return this.props.id
  }
  get eventId(): number {
    return this.props.eventId
  }
  get name(): string {
    return this.props.name
  }
  get start(): EventItemStart {
    return this.props.start
  }
  get place(): EventItemPlace | null {
    return this.props.place
  }
  get state(): EventItemState {
    return this.props.state
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
  get createdById(): number | null {
    return this.props.createdById
  }
  get updatedById(): number | null {
    return this.props.updatedById
  }

  /**
   * Changes the name, the date, the time or the place. The time stays only
   * with a date: what is left after the edit must hold that, or it is
   * EVENT_ITEM_TIME_WITHOUT_DATE and nothing changes. An edit that changes
   * nothing keeps the last Author.
   */
  edit(edit: EventItemEdit, stamp: Stamp): void {
    const start = EventItemStart.of(
      edit.date === undefined ? this.props.start.date : edit.date,
      edit.time === undefined ? this.props.start.time : edit.time,
    )
    const before = this.snapshot()
    if (edit.name !== undefined) this.props.name = edit.name.value
    this.props.start = start
    if (edit.place !== undefined) this.props.place = edit.place
    // An edit that changes nothing is no write: the item keeps its last Author.
    if (JSON.stringify(before) === JSON.stringify(this.snapshot())) return
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }

  /** The Event item as plain data at this moment. */
  snapshot(): EventItemSnapshot {
    return {
      id: this.props.id,
      name: this.props.name,
      date: this.props.start.date?.value ?? null,
      time: this.props.start.time?.value ?? null,
      place: this.props.place?.toValues() ?? null,
      state: this.props.state,
    }
  }
}
