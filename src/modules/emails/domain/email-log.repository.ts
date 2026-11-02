import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EmailLogEntry } from './email-log.js'

export abstract class EmailLogRepository {
  abstract record(entry: EmailLogEntry, stamp: Stamp): Promise<void>
}
