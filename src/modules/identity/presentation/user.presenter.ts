import type { User } from '../domain/user.entity.js'
import type { UserJson } from './dto/user.dto.js'

export const UserPresenter = {
  /** Never exposes the password hash. */
  toJson(user: User): UserJson {
    return {
      id: user.id,
      name: user.name,
      email: user.email.value,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    }
  },
}
