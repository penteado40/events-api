import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EventName } from './event-name.vo.js'
import type { EventPeriod, EventPeriodValues } from './event-period.vo.js'
import type { EventPlace } from './event-place.vo.js'

/**
 * The state the production moves an Event through. It is born in Draft, is
 * published by `publish()`, and is cancelled from Draft or published by
 * `cancel()`, until `uncancel()` gives it back the state before; going back to
 * Draft comes later.
 */
export const EVENT_STATES = ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const
export type EventState = (typeof EVENT_STATES)[number]

/** A state an Event can be cancelled from, and goes back to when uncancelled. */
export type CancellableEventState = Exclude<EventState, 'CANCELLED'>

export interface EventProps {
  id: number
  groupId: number
  name: string
  place: string
  period: EventPeriod
  state: EventState
  /** The state before the cancel, while Cancelled; null otherwise. */
  cancelledFrom: CancellableEventState | null
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
export interface EventEdit {
  name?: EventName
  place?: EventPlace
  period?: EventPeriod
}

/**
 * An Event at one moment, as plain data: its attributes and who it reaches
 * (the ids of the Users). Taken right before and right after a change, to
 * find its Changes.
 */
export interface EventSnapshot {
  name: string
  place: string
  period: EventPeriodValues
  state: EventState
  reach: readonly number[]
}

/**
 * Any commitment of a Group, from a rehearsal of an afternoon to a trip of
 * several days. It holds only where (a place, with its default zone) and when
 * (the period); everything else is an Event item. A Finished event is not a
 * state: it is derived from the period and stays editable. A Cancelled Event
 * is frozen: no write in it nor in its Event items until it is uncancelled.
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
  /** The state before the cancel, while Cancelled; null otherwise. */
  get cancelledFrom(): CancellableEventState | null {
    return this.props.cancelledFrom
  }
  get isCancelled(): boolean {
    return this.props.state === 'CANCELLED'
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
   * A Cancelled Event is EVENT_CANCELLED, even for an edit that changes nothing.
   */
  edit(edit: EventEdit, stamp: Stamp): void {
    this.assertWritable()
    const name = edit.name?.value ?? this.props.name
    const place = edit.place?.value ?? this.props.place
    const period = edit.period ?? this.props.period
    const changed =
      name !== this.props.name || place !== this.props.place || !period.equals(this.props.period)
    if (!changed) return
    this.props.name = name
    this.props.place = place
    this.props.period = period
    this.touch(stamp)
  }

  /**
   * Releases an Event in Draft: its published Event items start to reach whom
   * they reach. Only a Draft is published: a published Event is
   * EVENT_NOT_DRAFT, and a Cancelled one, frozen, EVENT_CANCELLED.
   */
  publish(stamp: Stamp): void {
    this.assertWritable()
    if (this.props.state !== 'DRAFT') throw new AppError('EVENT_NOT_DRAFT')
    this.props.state = 'PUBLISHED'
    this.touch(stamp)
  }

  /**
   * The Event, in Draft or published, will no longer happen: it stays visible,
   * Cancelled, and frozen until uncancelled. One already Cancelled is
   * EVENT_CANCELLED.
   */
  cancel(stamp: Stamp): void {
    const from = this.props.state
    if (from === 'CANCELLED') throw new AppError('EVENT_CANCELLED')
    this.props.cancelledFrom = from
    this.props.state = 'CANCELLED'
    this.touch(stamp)
  }

  /**
   * Gives a Cancelled Event back the state it was cancelled from, Draft or
   * published, and takes writes again. One that is not Cancelled is
   * EVENT_NOT_CANCELLED.
   */
  uncancel(stamp: Stamp): void {
    // Set exactly while Cancelled (and the table's check holds it there).
    const before = this.props.cancelledFrom
    if (before === null) throw new AppError('EVENT_NOT_CANCELLED')
    this.props.state = before
    this.props.cancelledFrom = null
    this.touch(stamp)
  }

  /**
   * Refuses a write in the Event or in any of its Event items while it is
   * Cancelled (EVENT_CANCELLED): it is frozen until uncancelled. Only
   * `uncancel()` writes in a Cancelled Event.
   */
  assertWritable(): void {
    if (this.isCancelled) throw new AppError('EVENT_CANCELLED')
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

  /** Marks the write's Author and instant as the Event's last (ADR-0013). */
  private touch(stamp: Stamp): void {
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}
