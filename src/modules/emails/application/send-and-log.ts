import type { Clock } from '../../../shared/application/clock.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { EmailKind } from '../domain/email-log.js'
import type { EmailLogRepository } from '../domain/email-log.repository.js'
import type { EmailSender, OutgoingEmail } from './ports/email-sender.js'

/**
 * One attempt to send, recorded in the Email log whatever the outcome. A send
 * failure lands in the log; only a failure to log escapes.
 */
export async function sendAndLog(
  deps: { sender: EmailSender; log: EmailLogRepository; clock: Clock },
  kind: EmailKind,
  recipient: string,
  stamp: Stamp,
  compose: () => OutgoingEmail,
): Promise<void> {
  let error: string | null = null
  try {
    await deps.sender.send(compose())
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause)
  }
  const status = error === null ? 'SENT' : 'FAILED'
  try {
    await deps.log.record(
      { kind, recipient, status, error },
      { by: stamp.by, at: deps.clock.now() },
    )
  } catch (cause) {
    throw new Error(`Email log não gravou a tentativa ${kind} para ${recipient} (${status})`, {
      cause,
    })
  }
}
