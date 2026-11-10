import type { Clock } from '../../../../shared/application/clock.js'
import type { EventPublisher } from '../../../../shared/application/ports/event-publisher.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { DomainEvent } from '../../../../shared/domain/domain-event.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import { type ActingUser, actorOf } from '../actor.js'

export interface RemoveViewerInput {
  actor: ActingUser
  groupId: number
  /** The Viewer to take out of the Group. */
  userId: number
}

/**
 * An Owner of the Group, or the Super admin, takes a Viewer out. After the
 * commit, GroupMemberRemoved goes out (best effort, ADR-0010); a Pending user
 * left with no Group member loses their Activation link in its handler. No
 * email is sent. The Roster is read under the Group's lock (ADR-0014). Who
 * cannot see the Group gets NOT_FOUND; a Viewer gets FORBIDDEN.
 */
export class RemoveViewerUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly members: GroupMemberRepository,
    private readonly events: EventPublisher,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveViewerInput): Promise<void> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId, userId } = input
    if (!AccessPolicy.can(actor, { type: 'viewGroup', groupId })) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'manageViewers', groupId })) {
      throw new AppError('FORBIDDEN')
    }

    const events = await this.unitOfWork.run<DomainEvent[]>(async () => {
      const roster = await this.rosters.lockByGroup(groupId)
      if (!roster) throw new AppError('NOT_FOUND')
      roster.removeViewer(userId, this.clock.now())
      await this.rosters.save(roster)
      return roster.pullEvents()
    })
    this.events.publish(events)
  }
}
