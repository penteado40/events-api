import type { EventRepository } from '../../domain/event.repository.js'
import { type EventMemberView, withUsers } from '../event-members.js'
import { loadEventFor } from '../event-access.js'
import type { UserDirectory } from '../ports/user-directory.js'
import type { Requester } from '../requester.js'

export interface ListEventMembersInput {
  actor: Requester
  eventId: number
}

export type ListEventMembersOutput = EventMemberView[]

/** Any Event member (and the Super admin) sees who else is in the Event. */
export class ListEventMembersUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserDirectory,
  ) {}

  async execute(input: ListEventMembersInput): Promise<ListEventMembersOutput> {
    await loadEventFor(this.events, input.actor, input.eventId, 'member:read')
    return withUsers(this.users, await this.events.listMembers(input.eventId))
  }
}
