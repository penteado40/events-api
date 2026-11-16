import { AppError } from '../../../shared/domain/app-error.js'
import type { ItemReachContext } from '../domain/event-item-reach.js'
import type { EventItem } from '../domain/event-item.entity.js'
import type { Field } from '../domain/field.entity.js'
import type { ActingUser } from './actor.js'
import { requireEventsEditor } from './event-access.js'
import { lockEventItem } from './event-item-lock.js'
import type { EventItemWriteDeps } from './event-item-write-deps.js'

/** What a write of a Field works on: its Event item, held, its Fields as they stand and what the reach rule weighs. */
export interface FieldWriteContext {
  item: EventItem
  /** The Fields of the item, in the order of the production, read under its lock. */
  fields: Field[]
  reach: ItemReachContext
}

/**
 * Runs a write of the Fields of an Event item, by an Owner of its Group or
 * the Super admin, in one unit of work. The role is checked before the state:
 * a Viewer is FORBIDDEN, never a 409. A Field is part of its item, so a
 * Cancelled Event (EVENT_CANCELLED) or a Cancelled item (EVENT_ITEM_CANCELLED)
 * freezes it, the order of the Fields included. The item is held as every
 * write of an item holds it (lockEventItem); the Fields are read under its
 * lock, which every write of them takes, so they are the ones that stand.
 */
export async function writeFieldsOf<T>(
  deps: EventItemWriteDeps,
  actor: ActingUser,
  target: { eventId: number; itemId: number },
  write: (context: FieldWriteContext) => Promise<T>,
): Promise<T> {
  const event = await deps.events.findById(target.eventId)
  if (!event) throw new AppError('NOT_FOUND')
  await requireEventsEditor(actor, event.groupId, deps.directory)

  return deps.unitOfWork.run(async () => {
    const { item, fields, reach } = await lockEventItem(deps, {
      groupId: event.groupId,
      eventId: event.id,
      itemId: target.itemId,
    })
    // A cancel of the item that came first freezes its Fields: EVENT_ITEM_CANCELLED.
    item.assertWritable()
    return write({ item, fields, reach })
  })
}
