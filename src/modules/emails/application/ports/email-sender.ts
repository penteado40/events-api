/** An email ready to go: who sends, to whom, and the fixed text of its Email kind. */
export interface OutgoingEmail {
  from: { name: string; address: string }
  to: string
  /** Where an answer goes; absent when nobody should get it. */
  replyTo?: string
  subject: string
  text: string
  html: string
}

/** Hands an email to the provider; throws when it is not accepted. */
export abstract class EmailSender {
  abstract send(email: OutgoingEmail): Promise<void>
}
