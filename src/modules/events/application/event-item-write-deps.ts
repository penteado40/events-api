import type { Clock } from '../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js'
import type { ChangeRepository } from '../domain/change.repository.js'
import type { EventItemRepository } from '../domain/event-item.repository.js'
import type { EventRepository } from '../domain/event.repository.js'
import type { FieldRepository } from '../domain/field.repository.js'
import type { ParticipantRepository } from '../domain/participant.repository.js'
import type { GroupDirectory } from './ports/group-directory.js'

/**
 * What every write of an Event item that is a Change with a reach (create,
 * edit, delete, publish, cancel, uncancel, and the writes of its Fields) works
 * with: the role check, the Event and the item under their locks, the
 * Participants and the Group members for the reach rule, the Fields, the
 * Changes, the unit of work and the clock. One bundle, so a new collaborator of these writes is added here and in its one
 * provider in the module. An abstract class, so it is its own injection token.
 */
export abstract class EventItemWriteDeps {
  abstract readonly directory: GroupDirectory
  abstract readonly events: EventRepository
  abstract readonly items: EventItemRepository
  abstract readonly participants: ParticipantRepository
  abstract readonly fields: FieldRepository
  abstract readonly changeLog: ChangeRepository
  abstract readonly unitOfWork: UnitOfWork
  abstract readonly clock: Clock
}
