import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { FieldName } from '../../domain/field.entity.js'
import { MANAUS_PERIOD } from './events-fixtures.js'
import { inMemoryEventItemWriteDeps } from './in-memory-event-item-write-deps.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')

/**
 * The deps of the Field writes in memory, with Group 1, its published Event
 * "Show em Manaus" and one published Event item, the Passagem de som. The
 * Group has no members yet: each spec adds whom it needs.
 */
export async function arrangeFieldWrites(now: Date) {
  const deps = inMemoryEventItemWriteDeps(now)
  deps.directory.addGroup(1)
  const event = await deps.events.create(
    {
      groupId: 1,
      name: EventName.create('Show em Manaus'),
      place: EventPlace.create('Manaus'),
      period: EventPeriod.create(MANAUS_PERIOD),
    },
    { by: null, at: CREATED_AT },
  )
  event.publish({ by: null, at: CREATED_AT })
  await deps.events.save(event)
  const item = await deps.items.create(
    {
      eventId: event.id,
      name: EventItemName.create('Passagem de som'),
      start: EventItemStart.create({ date: '2026-11-14', time: '15:00' }),
      place: null,
      position: 1,
      state: 'PUBLISHED',
    },
    { by: null, at: CREATED_AT },
  )
  const eventId = event.id
  const itemId = item.id
  return {
    deps,
    eventId,
    itemId,
    /** A text Field already in the item, written before the spec. */
    async addField(name: string, text = ''): Promise<number> {
      const fields = deps.fields.ofItem(itemId)
      const field = await deps.fields.create(
        {
          eventItemId: itemId,
          name: FieldName.create(name),
          value: { kind: 'TEXT', text },
          position: Math.max(0, ...fields.map((f) => f.position)) + 1,
        },
        { by: null, at: CREATED_AT },
      )
      return field.id
    },
    async cancelEvent(): Promise<void> {
      const frozen = (await deps.events.findById(eventId))!
      frozen.cancel({ by: null, at: CREATED_AT })
      await deps.events.save(frozen)
    },
    async cancelItem(): Promise<void> {
      const frozen = (await deps.items.lockInEvent(eventId, itemId))!
      frozen.cancel({ by: null, at: CREATED_AT })
      await deps.items.save(frozen)
    },
  }
}
