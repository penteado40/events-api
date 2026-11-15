import type { GroupMemberRole } from '../domain/event-access-policy.js'
import type { ItemReachContext, ReachEvent } from '../domain/event-item-reach.js'
import type { ParticipantRepository } from '../domain/participant.repository.js'

/**
 * What the reach rule weighs the Changes of an Event item against, read in
 * the write's unit of work: the Event under its lock, the Group members under
 * the Group's lock and the Participants of the Event.
 */
export async function itemReachContext(
  event: ReachEvent & { id: number },
  members: readonly GroupMemberRole[],
  participants: ParticipantRepository,
): Promise<ItemReachContext> {
  return { event, members, participants: await participants.findByEvent(event.id) }
}
