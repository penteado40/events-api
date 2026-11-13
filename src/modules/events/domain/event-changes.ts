import type { ChangeValue, NewChange } from './change.js'
import type { EventSnapshot } from './event.entity.js'

/** The attributes of an Event that make Changes, in the order their Changes come. */
const EVENT_ATTRIBUTES = ['name', 'place', 'period', 'state'] as const

/**
 * The Changes between two snapshots of an Event: one per attribute that
 * changed, none when nothing did. The period is one attribute (its dates and
 * zone travel together). Where and when are seen by every Group member, so no
 * Change of an Event is only for the production. Who made them and when is
 * the Stamp of the change, written with them.
 */
export function eventChanges(before: EventSnapshot, after: EventSnapshot): NewChange[] {
  return EVENT_ATTRIBUTES.filter(
    (attribute) => !sameValue(before[attribute], after[attribute]),
  ).map((attribute) => ({
    attribute,
    before: valueOf(before[attribute]),
    after: valueOf(after[attribute]),
    productionOnly: false,
    reachBefore: [...before.reach],
    reachAfter: [...after.reach],
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
