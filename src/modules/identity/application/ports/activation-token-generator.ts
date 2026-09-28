export interface GeneratedActivationToken {
  /** Goes to the person who delivers the Activation link; never stored. */
  token: string
  tokenHash: string
}

export abstract class ActivationTokenGenerator {
  abstract generate(): GeneratedActivationToken
  abstract hash(token: string): string
}
