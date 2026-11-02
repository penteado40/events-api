import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { type EmailLogEntry, EmailLogRepository } from '../../domain/email-log.js'

export type StoredEmailLogEntry = EmailLogEntry & ReturnType<typeof createdWith>

export class InMemoryEmailLogRepository extends EmailLogRepository {
  private readonly entries: StoredEmailLogEntry[] = []

  async record(entry: EmailLogEntry, stamp: Stamp): Promise<void> {
    this.entries.push({ ...entry, ...createdWith(stamp) })
  }

  all(): StoredEmailLogEntry[] {
    return [...this.entries]
  }
}
