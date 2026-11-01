import type { Stamp } from '../../../../shared/domain/stamp.js'
import {
  type EnsuredGroupUser,
  type GroupUser,
  GroupUserAccounts,
} from '../ports/group-user-accounts.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Users by email, with ids from 10 and links that expire 7 days after `now`
 * (`...invitation=1`, `=2`...). `failNextDrop` makes the next revoke throw.
 */
export class FakeGroupUserAccounts extends GroupUserAccounts {
  private readonly users = new Map<string, GroupUser>()
  private readonly createdUsers: GroupUser[] = []
  private readonly stamps: Stamp[] = []
  private readonly droppedIds: number[] = []
  private nextId = 10
  private nextLink = 1
  private failingDrop = false

  constructor(private readonly now: Date) {
    super()
  }

  async ensureUser(
    input: { email: string; name: string; phone: string },
    stamp: Stamp,
  ): Promise<EnsuredGroupUser> {
    this.stamps.push(stamp)
    const email = input.email.trim().toLowerCase()
    const found = this.users.get(email)
    if (found) return { user: found, activationLink: null }

    const user = this.store({ email, name: input.name.trim(), isPending: true })
    this.createdUsers.push(user)
    const link = this.nextLink++
    return {
      user,
      activationLink: {
        url: `https://accounts.clerk.test/accept?invitation=${link}`,
        expiresAt: new Date(this.now.getTime() + 7 * DAY_MS),
      },
    }
  }

  async dropPendingActivation(userId: number): Promise<void> {
    if (this.failingDrop) {
      this.failingDrop = false
      throw new Error('fake accounts: drop failed')
    }
    this.droppedIds.push(userId)
  }

  /** Arranges a User that already exists, active unless told otherwise. */
  existing(props: { email: string; name: string; isSuperAdmin?: boolean; isPending?: boolean }) {
    return this.store({ isPending: false, ...props })
  }

  failNextDrop(): void {
    this.failingDrop = true
  }

  /** The stamps of every ensureUser call, in order. */
  ensuredBy(): Stamp[] {
    return [...this.stamps]
  }

  created(): GroupUser[] {
    return [...this.createdUsers]
  }

  dropped(): number[] {
    return [...this.droppedIds]
  }

  private store(props: {
    email: string
    name: string
    isSuperAdmin?: boolean
    isPending: boolean
  }): GroupUser {
    const user: GroupUser = {
      id: this.nextId++,
      name: props.name,
      email: props.email,
      isSuperAdmin: props.isSuperAdmin ?? false,
      isPending: props.isPending,
    }
    this.users.set(user.email, user)
    return user
  }
}
