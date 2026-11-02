import type { Stamp } from '../../../shared/domain/stamp.js'

/** Why an email goes out (glossary: Email kind). Only the account's Activation link so far. */
export type EmailKind = 'ACCOUNT_ACTIVATION_LINK'

export type EmailStatus = 'SENT' | 'FAILED'

/** One attempt to send an email (glossary: Email log), for diagnosis only. */
export interface EmailLogEntry {
  kind: EmailKind
  recipient: string
  status: EmailStatus
  /** What went wrong, when the attempt failed. */
  error: string | null
}

export abstract class EmailLogRepository {
  abstract record(entry: EmailLogEntry, stamp: Stamp): Promise<void>
}
