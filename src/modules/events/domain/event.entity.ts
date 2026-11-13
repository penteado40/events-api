import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EventSnapshot } from './event-changes.js'
import type { EventName } from './event-name.vo.js'
import type { EventPeriod } from './event-period.vo.js'
import type { EventPlace } from './event-place.vo.js'

/** The state the production moves an Event through. It is born in Draft; publishing and cancelling come later. */
export const EVENT_STATES = ['DRAFT'] as const
export type EventState = (typeof EVENT_STATES)[number]

export interface EventProps {
  id: number
  groupId: number
  name: string
  place: string
  period: EventPeriod
  state: EventState
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewEventProps {
  groupId: number
  name: EventName
  place: EventPlace
  period: EventPeriod
}

/** What an edit may change; a field left out stays as it is. */
export interface EventChanges {
  name?: EventName
  place?: EventPlace
  period?: EventPeriod
}

/**
 * Any commitment of a Group, from a rehearsal of an afternoon to a trip of
 * several days. It holds only where (a place, with its default zone) and when
 * (the period); everything else is an Event item. A Finished event is not a
 * state: it is derived from the period and stays editable.
 */
export class Event {
  private constructor(private readonly props: EventProps) {}

  static restore(props: EventProps): Event {
    return new Event({ ...props })
  }

  get id(): number {
    return this.props.id
  }
  get groupId(): number {
    return this.props.groupId
  }
  get name(): string {
    return this.props.name
  }
  get place(): string {
    return this.props.place
  }
  get period(): EventPeriod {
    return this.props.period
  }
  get state(): EventState {
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

  /** Whether the period is over at that instant, by the calendar of the Event's zone. */
  isFinished(at: Date): boolean {
    return this.props.period.hasEnded(at)
  }

  /**
   * Changes the name, the place or the period, a Finished event included. An
   * edit that changes nothing is no write: the Event keeps its last Author.
   */
  edit(changes: EventChanges, stamp: Stamp): void {
    const name = changes.name?.value ?? this.props.name
    const place = changes.place?.value ?? this.props.place
    const period = changes.period ?? this.props.period
    const changed =
      name !== this.props.name || place !== this.props.place || !period.equals(this.props.period)
    if (!changed) return
    this.props.name = name
    this.props.place = place
    this.props.period = period
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }

  /** The Event as plain data at this moment, with who it reaches, for its Changes. */
  snapshot(reach: readonly number[]): EventSnapshot {
    return {
      name: this.props.name,
      place: this.props.place,
      period: this.props.period.toValues(),
      state: this.props.state,
      reach: [...reach],
    }
  }
}
