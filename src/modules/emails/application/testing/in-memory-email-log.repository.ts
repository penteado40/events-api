import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import type { EmailLogEntry } from '../../domain/email-log.js'
import { EmailLogRepository } from '../../domain/email-log.repository.js'

export type StoredEmailLogEntry = EmailLogEntry & ReturnType<typeof createdWith>

export class InMemoryEmailLogRepository extends EmailLogRepository {
  private readonly entries: StoredEmailLogEntry[] = []
  private failing = false

  async record(entry: EmailLogEntry, stamp: Stamp): Promise<void> {
    if (this.failing) {
      this.failing = false
      throw new Error('in-memory email log: record failed')
    }
    this.entries.push({ ...entry, ...createdWith(stamp) })
  }

  /** The next record throws, as the database going away would. */
  failNextRecord(): void {
    this.failing = true
  }

  all(): StoredEmailLogEntry[] {
    return [...this.entries]
  }
}
