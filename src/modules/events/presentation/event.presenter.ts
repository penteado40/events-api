import type { EventView } from '../application/event-view.js'
import type { GetEventOutput } from '../application/use-cases/get-event.use-case.js'
import type { ParticipantView } from '../application/use-cases/list-participants.use-case.js'
import type { EventDetailJson, EventJson, ParticipantJson } from './dto/event.dto.js'

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

  toDetailJson(view: GetEventOutput): EventDetailJson {
    return { ...EventPresenter.toJson(view), membership: view.membership }
  },

  toParticipantJson({ userId, name, phone, role }: ParticipantView): ParticipantJson {
    return { userId, name, phone, role }
  },
}
