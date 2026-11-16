import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { FakeGroupDirectory } from './fake-group-directory.js'
import { FakeUserDirectory } from './fake-user-directory.js'
import { InMemoryChangeRepository } from './in-memory-change.repository.js'
import { InMemoryEventItemRepository } from './in-memory-event-item.repository.js'
import { InMemoryEventRepository } from './in-memory-event.repository.js'
import { InMemoryFieldRepository } from './in-memory-field.repository.js'
import { InMemoryParticipantRepository } from './in-memory-participant.repository.js'

/** The deps of the Event item writes, in memory, typed as the fakes so a spec can arrange and read them; the clock stands at `now`. */
export function inMemoryEventItemWriteDeps(now: Date) {
  const events = new InMemoryEventRepository()
  const items = new InMemoryEventItemRepository()
  return {
    directory: new FakeGroupDirectory(),
    events,
    items,
    participants: new InMemoryParticipantRepository(events),
    fields: new InMemoryFieldRepository(items),
    users: new FakeUserDirectory(),
    changeLog: new InMemoryChangeRepository(),
    unitOfWork: new InMemoryUnitOfWork(),
    clock: new FixedClock(now),
  } satisfies EventItemWriteDeps
}
