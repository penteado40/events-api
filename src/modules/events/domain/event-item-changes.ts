import type { ChangeValue, NewChange } from './change.js'
import { EventItemAudience, sameAudience } from './event-item-audience.vo.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import { eventItemReach, type ItemReachContext } from './event-item-reach.js'

/** The attributes of an Event item that make Changes on an edit or a move of state, in the order their Changes come. */
const EVENT_ITEM_ATTRIBUTES = ['name', 'date', 'time', 'place', 'state', 'audience'] as const

/** The attributes whose Changes only the production sees (CONTEXT.md, Change). */
const PRODUCTION_ONLY_ATTRIBUTES: ReadonlySet<string> = new Set(['audience'])

/**
 * The Changes between two snapshots of an Event item, null for an item that
 * does not exist: a creation (null before) or a removal (null after) is one
 * Change of the attribute `item`, with the item's attributes on the side where
 * it exists; an edit is one Change per attribute that changed, none when
 * nothing did. The date and the time are apart: moving the Passagem de som
 * from 15h to 16h changes only the time; publishing a Draft is a Change of
 * the state. A Change of the Audience only the production sees; who starts
 * or stops being reached by it notices by the item that shows up or goes
 * away, never by a value struck through. The Audience stays out of the
 * Change of a creation or a removal, which the people it reaches see. The
 * reach of before and of after come from the reach rule
 * (eventItemReach) over the Event, Group members and Participants given.
 * Who made them and when is the Stamp of the change, written with them.
 */
export function eventItemChanges(
  before: EventItemSnapshot | null,
  after: EventItemSnapshot | null,
  reach: ItemReachContext,
): NewChange[] {
  const item = after ?? before
  if (item === null) return []
  const reachOf = (snapshot: EventItemSnapshot | null): number[] => eventItemReach(snapshot, reach)
  const change = (attribute: string, from: ChangeValue, to: ChangeValue): NewChange => ({
    eventItemId: item.id,
    attribute,
    before: from,
    after: to,
    productionOnly: PRODUCTION_ONLY_ATTRIBUTES.has(attribute),
    reachBefore: reachOf(before),
    reachAfter: reachOf(after),
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
  if (value === null || typeof value === 'string') return value
  if ('kind' in value) return EventItemAudience.create(value).toValues()
  return { ...value }
}

function sameValue(a: EventItemAttributeValue, b: EventItemAttributeValue): boolean {
  if (a === null || b === null || typeof a === 'string' || typeof b === 'string') return a === b
  if ('kind' in a || 'kind' in b) return 'kind' in a && 'kind' in b && sameAudience(a, b)
  return a.name === b.name && a.address === b.address && a.timezone === b.timezone
}
