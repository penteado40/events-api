import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ChangeValue, NewChange } from './change.js'
import type { EventPeriodValues } from './event-period.vo.js'
import type { EventState } from './event.entity.js'

/**
 * An Event at one moment, as plain data: its attributes and who it reaches
 * (the ids of the Users). Taken right before and right after a change.
 */
export interface EventSnapshot {
  name: string
  place: string
  period: EventPeriodValues
  state: EventState
  reach: readonly number[]
}

/** The attributes of an Event that make Changes, in the order their Changes come. */
const EVENT_ATTRIBUTES = ['name', 'place', 'period', 'state'] as const

/**
 * The Changes between two snapshots of an Event: one per attribute that
 * changed, none when nothing did. The period is one attribute (its dates and
 * zone travel together). Where and when are seen by every Group member, so no
 * Change of an Event is only for the production.
 */
export function eventChanges(
  before: EventSnapshot,
  after: EventSnapshot,
  stamp: Stamp,
): NewChange[] {
  return EVENT_ATTRIBUTES.filter(
    (attribute) => !sameValue(before[attribute], after[attribute]),
  ).map((attribute) => ({
    attribute,
    before: valueOf(before[attribute]),
    after: valueOf(after[attribute]),
    productionOnly: false,
    reachBefore: [...before.reach],
    reachAfter: [...after.reach],
    by: stamp.by,
    at: stamp.at,
  }))
}

type EventAttributeValue = EventSnapshot[(typeof EVENT_ATTRIBUTES)[number]]

function valueOf(value: EventAttributeValue): ChangeValue {
  return typeof value === 'string' ? value : { ...value }
}

function sameValue(a: EventAttributeValue, b: EventAttributeValue): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b
  return a.startDate === b.startDate && a.endDate === b.endDate && a.timezone === b.timezone
}
