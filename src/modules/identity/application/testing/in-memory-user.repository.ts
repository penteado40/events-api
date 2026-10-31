import { AppError } from '../../../../shared/domain/app-error.js'
import type { Email } from '../../../../shared/domain/email.vo.js'
import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { type NewUserProps, User } from '../../domain/user.entity.js'
import { UserRepository } from '../../domain/user.repository.js'

export class InMemoryUserRepository extends UserRepository {
  private readonly users = new Map<number, User>()
  /** The stored links, apart from the entities: a test can change them behind a request's back. */
  private readonly clerkIds = new Map<number, string>()
  private nextId = 1
  /** A User another request creates right before the next create, which then collides. */
  private concurrent: NewUserProps | null = null

  async findByEmail(email: Email): Promise<User | null> {
    return [...this.users.values()].find((u) => u.email.equals(email)) ?? null
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    const entry = [...this.clerkIds].find(([, linked]) => linked === clerkId)
    return entry ? (this.users.get(entry[0]) ?? null) : null
  }

  async findById(id: number): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async findManyByIds(ids: number[]): Promise<User[]> {
    return ids.flatMap((id) => this.users.get(id) ?? [])
  }

  async create(props: NewUserProps, stamp: Stamp): Promise<User> {
    if (this.concurrent) {
      const winner = this.concurrent
      this.concurrent = null
      await this.create(winner, stamp)
    }
    if ([...this.users.values()].some((u) => u.email.equals(props.email))) {
      throw new AppError('EMAIL_ALREADY_IN_USE')
    }
    const user = User.restore({
      ...props,
      id: this.nextId++,
      clerkId: null,
      ...createdWith(stamp),
    })
    this.users.set(user.id, user)
    return user
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user)
    if (user.clerkId !== null) this.clerkIds.set(user.id, user.clerkId)
  }

  async saveClerkLink(user: User): Promise<boolean> {
    if (this.clerkIds.has(user.id) || user.clerkId === null) return false
    if ([...this.clerkIds.values()].includes(user.clerkId)) return false
    await this.save(user)
    return true
  }

  /** Another request's link landing in storage, without touching the entities already read. */
  linkConcurrently(userId: number, clerkId: string): void {
    this.clerkIds.set(userId, clerkId)
  }

  /** Another request creates this User between the next create's check and its write. */
  createConcurrently(props: NewUserProps): void {
    this.concurrent = props
  }

  all(): User[] {
    return [...this.users.values()]
  }
}
