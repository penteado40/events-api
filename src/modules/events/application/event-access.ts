import { AppError } from '../../../shared/domain/app-error.js'
import { AccessPolicy, type EventAction } from '../domain/access-policy.js'
import type { EventRepository, EventWithMembership } from '../domain/event.repository.js'
import type { Requester } from './requester.js'

/**
 * Loads an Event for the Requester and asks the AccessPolicy about the action.
 * Someone who is not a member gets FORBIDDEN whether or not the Event exists, so
 * ids do not leak; only the Super admin gets NOT_FOUND.
 */
export async function loadEventFor(
  events: EventRepository,
  actor: Requester,
  eventId: number,
  action: EventAction,
): Promise<EventWithMembership> {
  const membership = actor.isSuperAdmin ? null : await events.findMembership(eventId, actor.id)
  if (!actor.isSuperAdmin && !membership) throw new AppError('FORBIDDEN')

  const event = await events.findById(eventId)
  if (!event) throw new AppError(actor.isSuperAdmin ? 'NOT_FOUND' : 'FORBIDDEN')

  AccessPolicy.assert({ isSuperAdmin: actor.isSuperAdmin, membership }, action, event)
  return { event, membership }
}
