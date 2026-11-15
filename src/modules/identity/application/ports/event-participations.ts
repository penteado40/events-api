/** A User's place in the list of Participants of one Event, with the Group of the Event. */
export interface Participation {
  groupId: number
  eventId: number
}

/**
 * Reads the Events a User is a Participant of, from the events context. events
 * depends on identity, so identity declares the port and events implements it
 * (docs/arquitetura.md §5.5).
 */
export abstract class EventParticipations {
  /** In the order the Events were created. */
  abstract ofUser(userId: number): Promise<Participation[]>
}
