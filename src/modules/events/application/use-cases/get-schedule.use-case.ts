import { AppError } from '../../../../shared/domain/app-error.js'
import { standingOf, eventItemReaches } from '../../domain/event-item-reach.js'
import { type FieldSnapshot, peopleInFields } from '../../domain/field.entity.js'
import { assembleSchedule, type Schedule } from '../../domain/schedule.js'
import type { ActingUser } from '../actor.js'
import { requireEventsReader } from '../event-access.js'
import type { EventScheduleReader } from '../ports/event-schedule-reader.js'
import type { GroupDirectory } from '../ports/group-directory.js'
import type { UserDirectory } from '../ports/user-directory.js'
import { namesOf } from '../user-names.js'

export interface GetScheduleInput {
  actor: ActingUser
  eventId: number
}

export type GetScheduleOutput = Schedule

/**
 * A Group member, or the Super admin, reads the schedule of an Event: the
 * General info and the Timeline, with only the Event items that reach them.
 * The Event is loaded whole as plain data by the read port, each item goes
 * through the reach rule and the schedule is assembled in memory (ADR-0019),
 * each item with its Fields, in the order of the production, the people of
 * a people Field by name (asked of identity). Whoever is in a people Field
 * of an item, and a Participant, is reached by it, whatever its Audience.
 * The production (an Owner, or the Super admin) sees every item; a Viewer,
 * only the published and Cancelled ones of a published Event they are a
 * Participant of, and so an empty schedule otherwise: where and when are the
 * Event's own.
 */
export class GetScheduleUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly reader: EventScheduleReader,
    private readonly users: UserDirectory,
  ) {}

  async execute(input: GetScheduleInput): Promise<GetScheduleOutput> {
    const data = await this.reader.load(input.eventId)
    if (!data) throw new AppError('NOT_FOUND')
    const actor = await requireEventsReader(input.actor, data.groupId, this.directory)
    const standing = standingOf(actor, input.actor.id, data.participants.includes(input.actor.id))
    const fieldsByItem = new Map<number, FieldSnapshot[]>()
    for (const field of data.fields) {
      fieldsByItem.set(field.eventItemId, [...(fieldsByItem.get(field.eventItemId) ?? []), field])
    }
    const items = data.items.filter((item) =>
      eventItemReaches(item, data, standing, peopleInFields(fieldsByItem.get(item.id) ?? [])),
    )
    const fields = items.flatMap((item) => fieldsByItem.get(item.id) ?? [])
    const names = await namesOf(peopleInFields(fields), this.users)
    return assembleSchedule({ timezone: data.timezone, items, fields, names })
  }
}
