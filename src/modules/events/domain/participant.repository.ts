import type { Stamp } from '../../../shared/domain/stamp.js'

/**
 * The list of Participants of each Event (CONTEXT.md): the Users who go to
 * it, a cut of the Group. Born as a copy of the Group members when the Event
 * is created, in the same unit of work; who joins the Group later is not
 * added.
 */
export abstract class ParticipantRepository {
  /** Adds the Users, in the order given, to the Participants of the Event. */
  abstract addMany(eventId: number, userIds: readonly number[], stamp: Stamp): Promise<void>
  /** The User ids of the Participants of the Event, in the order they were added. */
  abstract findByEvent(eventId: number): Promise<number[]>
  abstract isParticipant(eventId: number, userId: number): Promise<boolean>
}
