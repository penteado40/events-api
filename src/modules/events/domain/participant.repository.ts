import type { Stamp } from '../../../shared/domain/stamp.js'

/**
 * The list of Participants of each Event (CONTEXT.md): the Users who go to
 * it, a cut of the Group. Born as a copy of the Group members when the Event
 * is created, in the same unit of work; who joins the Group later is not
 * added.
 */
export abstract class ParticipantRepository {
  /** Adds the Users, in the order given, to the Participants of the Event. */
  abstract create(eventId: number, userIds: readonly number[], stamp: Stamp): Promise<void>
  /** Takes the User off the Participants of the Event; nothing when they are not one. */
  abstract remove(eventId: number, userId: number): Promise<void>
  /** The User ids of the Participants of the Event, in the order they were added. */
  abstract findByEvent(eventId: number): Promise<number[]>
  abstract isParticipant(eventId: number, userId: number): Promise<boolean>
  /** The Events the User is a Participant of, with their Group, in the order the Events were created. */
  abstract findByUser(userId: number): Promise<{ groupId: number; eventId: number }[]>
}
