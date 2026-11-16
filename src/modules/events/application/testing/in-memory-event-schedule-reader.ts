import { type EventScheduleData, EventScheduleReader } from '../ports/event-schedule-reader.js'
import type { InMemoryEventItemRepository } from './in-memory-event-item.repository.js'
import type { InMemoryEventRepository } from './in-memory-event.repository.js'
import { InMemoryFieldRepository } from './in-memory-field.repository.js'
import type { InMemoryParticipantRepository } from './in-memory-participant.repository.js'

/** The read port over the in-memory Events, Event items, their Fields and Participants. */
export class InMemoryEventScheduleReader extends EventScheduleReader {
  constructor(
    private readonly events: InMemoryEventRepository,
    private readonly items: InMemoryEventItemRepository,
    private readonly participants: InMemoryParticipantRepository,
    private readonly fields: InMemoryFieldRepository = new InMemoryFieldRepository(items),
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
      state: event.state,
      cancelledFrom: event.cancelledFrom,
      participants: await this.participants.findByEvent(eventId),
      items: this.items.ofEvent(eventId).map((item) => item.snapshot()),
      fields: (await this.fields.findAllInEvent(eventId)).map((field) => field.snapshot()),
    }
  }
}
