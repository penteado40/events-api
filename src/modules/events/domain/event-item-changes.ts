import type { ChangeValue, NewChange } from './change.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import type { GroupMemberRole } from './event-access-policy.js'
import { eventItemReach } from './event-item-reach.js'

/** The attributes of an Event item that make Changes on an edit, in the order their Changes come. */
const EVENT_ITEM_ATTRIBUTES = ['name', 'date', 'time', 'place'] as const

/**
 * The Changes between two snapshots of an Event item, null for an item that
 * does not exist: a creation (null before) or a removal (null after) is one
 * Change of the attribute `item`, with the item's attributes on the side where
 * it exists; an edit is one Change per attribute that changed, none when
 * nothing did. The date and the time are apart: moving the Passagem de som
 * from 15h to 16h changes only the time. The reach of before and of after
 * come from the reach rule (eventItemReach) over the Group members given.
 * Who made them and when is the Stamp of the change, written with them.
 */
export function eventItemChanges(
  before: EventItemSnapshot | null,
  after: EventItemSnapshot | null,
  members: readonly GroupMemberRole[],
): NewChange[] {
  const item = after ?? before
  if (item === null) return []
  const change = (attribute: string, from: ChangeValue, to: ChangeValue): NewChange => ({
    eventItemId: item.id,
    attribute,
    before: from,
    after: to,
    productionOnly: false,
    reachBefore: eventItemReach(before, members),
    reachAfter: eventItemReach(after, members),
  })
  if (before === null || after === null) {
    return [change('item', itemValue(before), itemValue(after))]
  }
  return EVENT_ITEM_ATTRIBUTES.filter(
    (attribute) => !sameValue(before[attribute], after[attribute]),
  ).map((attribute) => change(attribute, valueOf(before[attribute]), valueOf(after[attribute])))
}

type EventItemAttributeValue = EventItemSnapshot[(typeof EVENT_ITEM_ATTRIBUTES)[number]]

/** The item as a creation or a removal keeps it: what it was, never its id. */
function itemValue(item: EventItemSnapshot | null): ChangeValue {
  if (item === null) return null
  return {
    name: item.name,
    date: item.date,
    time: item.time,
    place: valueOf(item.place),
    state: item.state,
  }
}

function valueOf(value: EventItemAttributeValue): ChangeValue {
  return value === null || typeof value === 'string' ? value : { ...value }
}

function sameValue(a: EventItemAttributeValue, b: EventItemAttributeValue): boolean {
  if (a === null || b === null || typeof a === 'string' || typeof b === 'string') return a === b
  return a.name === b.name && a.address === b.address && a.timezone === b.timezone
}
