import type { EventView } from '../application/event-view.js'
import type { EventJson } from './dto/event.dto.js'

export const EventPresenter = {
  /** The period goes out as written, never converted; technical instants in ISO 8601 UTC. */
  toJson({ event, isFinished }: EventView): EventJson {
    return {
      id: event.id,
      groupId: event.groupId,
      name: event.name,
      place: event.place,
      period: event.period.toValues(),
      state: event.state,
      isFinished,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    }
  },
}
