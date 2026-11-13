import type { EventItemView } from '../application/event-item-view.js'
import type { Schedule, ScheduleItem } from '../domain/schedule.js'
import type { EventItemJson, ScheduleItemJson, ScheduleJson } from './dto/event-item.dto.js'

export const EventItemPresenter = {
  /** Date and time go out as written, never converted; technical instants in ISO 8601 UTC. */
  toJson({ item, when }: EventItemView): EventItemJson {
    return {
      id: item.id,
      eventId: item.eventId,
      name: item.name,
      when,
      place: item.place?.toValues() ?? null,
      state: item.state,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }
  },

  scheduleToJson(schedule: Schedule): ScheduleJson {
    return {
      generalInfo: schedule.generalInfo.map(scheduleItemJson),
      timeline: schedule.timeline.map((day) => ({
        date: day.date,
        items: day.items.map(scheduleItemJson),
      })),
    }
  },
}

function scheduleItemJson(item: ScheduleItem): ScheduleItemJson {
  return { id: item.id, name: item.name, when: item.when, place: item.place, state: item.state }
}
