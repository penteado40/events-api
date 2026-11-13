import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface DeleteEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
}

/** An Owner of its Group, or the Super admin, deletes an Event item of the Event. */
export class DeleteEventItemUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: DeleteEventItemInput): Promise<void> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)
    await this.unitOfWork.run(async () => {
      // Under the lock, a delete or an edit that came first leaves it gone: NOT_FOUND.
      const item = await this.items.lockInEvent(event.id, input.itemId)
      if (!item) throw new AppError('NOT_FOUND')
      await this.items.delete(item.id)
    })
  }
}
