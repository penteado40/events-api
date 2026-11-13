import { type EventScheduleData, EventScheduleReader } from '../ports/event-schedule-reader.js'
import type { InMemoryEventItemRepository } from './in-memory-event-item.repository.js'
import type { InMemoryEventRepository } from './in-memory-event.repository.js'

/** The read port over the in-memory Events and Event items. */
export class InMemoryEventScheduleReader extends EventScheduleReader {
  constructor(
    private readonly events: InMemoryEventRepository,
    private readonly items: InMemoryEventItemRepository,
  ) {
    super()
  }

  async load(eventId: number): Promise<EventScheduleData | null> {
    const event = await this.events.findById(eventId)
    if (!event) return null
    return {
      eventId: event.id,
      groupId: event.groupId,
      timezone: event.period.timezone.value,
      items: this.items.ofEvent(eventId).map((item) => item.snapshot()),
    }
  }
}
