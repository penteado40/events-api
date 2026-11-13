import { AppError } from '../../../../shared/domain/app-error.js'
import { assembleSchedule, type Schedule } from '../../domain/schedule.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import type { EventScheduleReader } from '../ports/event-schedule-reader.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface GetScheduleInput {
  actor: ActingUser
  eventId: number
}

export type GetScheduleOutput = Schedule

/**
 * The production (an Owner of its Group, or the Super admin) reads the whole
 * schedule of an Event: the General info and the Timeline. The Event is loaded
 * whole as plain data by the read port and the schedule assembled in memory
 * (ADR-0019). A Viewer gets FORBIDDEN for now: reading their own schedule
 * comes with the reach rule.
 */
export class GetScheduleUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly reader: EventScheduleReader,
  ) {}

  async execute(input: GetScheduleInput): Promise<GetScheduleOutput> {
    const data = await this.reader.load(input.eventId)
    if (!data) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, data.groupId, this.directory)
    return assembleSchedule({ timezone: data.timezone, items: data.items })
  }
}
