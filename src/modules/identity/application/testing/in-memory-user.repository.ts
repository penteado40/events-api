import type { Email } from '../../../../shared/domain/email.vo.js'
import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { type NewUserProps, User } from '../../domain/user.entity.js'
import { UserRepository } from '../../domain/user.repository.js'

export class InMemoryUserRepository extends UserRepository {
  private readonly users = new Map<number, User>()
  private nextId = 1

  async findByEmail(email: Email): Promise<User | null> {
    return [...this.users.values()].find((u) => u.email.equals(email)) ?? null
  }

  async findById(id: number): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async create(props: NewUserProps, stamp: Stamp): Promise<User> {
    const user = User.restore({
      ...props,
      id: this.nextId++,
      passwordChangedAt: null,
      ...createdWith(stamp),
    })
    this.users.set(user.id, user)
    return user
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user)
  }

  all(): User[] {
    return [...this.users.values()]
  }
}
