export interface ActivationLinkProps {
  id: number
  userId: number
  /** The Clerk invitation the link is (ADR-0020); its url is never stored. */
  invitationId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewActivationLinkProps {
  userId: number
  invitationId: string
  expiresAt: Date
}

/** The invitation through which a Pending user signs in for the first time. */
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
  get invitationId(): string {
    return this.props.invitationId
  }
  get expiresAt(): Date {
    return this.props.expiresAt
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
  get createdById(): number | null {
    return this.props.createdById
  }
  get updatedById(): number | null {
    return this.props.updatedById
  }
}
