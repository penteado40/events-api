import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { reorderEventItems } from '../../domain/event-item-order.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface ReorderEventItemsInput {
  actor: ActingUser
  eventId: number
  /** The whole tie group, as it stands, in the new order. */
  itemIds: number[]
}

/**
 * An Owner of its Group, or the Super admin, puts a tie group of the Event's
 * items (those where the time does not decide: the General info, one day with
 * no time, one day at the same time) in a new order (reorderEventItems). A
 * Cancelled Event is frozen: EVENT_CANCELLED.
 *
 * The new order is one Change of the Event that only the production sees,
 * written in the same unit of work (amendment of ADR-0010); the same order
 * writes nothing. The items are read under the Event's lock, which every
 * other write of the Event's items takes too, so the group is the one that
 * stands when the positions land.
 */
export class ReorderEventItemsUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReorderEventItemsInput): Promise<void> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)
    const stamp = { by: input.actor.id, at: this.clock.now() }
    await this.unitOfWork.run(async () => {
      // Locks go Group, then Event, always (see EditEventItemUseCase).
      const members = await this.directory.lockMembers(event.groupId)
      // Under the Event's lock, a cancel that came first freezes the order: EVENT_CANCELLED.
      const frozen = await this.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      const items = await this.items.findAllInEvent(event.id)
      const { positions, changes } = reorderEventItems(
        items.map((item) => item.snapshot()),
        input.itemIds,
        members,
      )
      if (changes.length === 0) return
      await this.items.reposition(positions)
      await this.changeLog.create(event.id, changes, stamp)
    })
  }
}
