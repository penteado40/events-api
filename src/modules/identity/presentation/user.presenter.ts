import type { Me } from '../application/me.js'
import type { User } from '../domain/user.entity.js'
import type { MeJson, UserJson } from './dto/user.dto.js'

export const UserPresenter = {
  toJson(user: User): UserJson {
    return {
      id: user.id,
      name: user.name,
      email: user.email.value,
      phone: user.phone.value,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    }
  },

  toMeJson(me: Me): MeJson {
    return {
      ...UserPresenter.toJson(me.user),
      isSuperAdmin: me.isSuperAdmin,
      memberships: me.memberships,
    }
  },
}
