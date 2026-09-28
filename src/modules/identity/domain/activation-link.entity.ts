export interface ActivationLinkProps {
  id: number
  userId: number
  /** SHA-256 of the token; the token itself is never stored. */
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export interface NewActivationLinkProps {
  userId: number
  tokenHash: string
  expiresAt: Date
}

/** Single-use link through which a Pending user sets their own password. */
export class ActivationLink {
  private constructor(private readonly props: ActivationLinkProps) {}

  static restore(props: ActivationLinkProps): ActivationLink {
    return new ActivationLink({ ...props })
  }

  get id(): number {
    return this.props.id
  }
  get userId(): number {
    return this.props.userId
  }
  get tokenHash(): string {
    return this.props.tokenHash
  }
  get expiresAt(): Date {
    return this.props.expiresAt
  }
  get usedAt(): Date | null {
    return this.props.usedAt
  }
  get createdAt(): Date {
    return this.props.createdAt
  }

  get isUsed(): boolean {
    return this.props.usedAt !== null
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime()
  }
}
