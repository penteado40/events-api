import type { IssuedActivationLink } from '../application/activation-links.js'
import type { Me } from '../application/me.js'
import type { User } from '../domain/user.entity.js'
import type { ActivationLinkJson } from './dto/user-management.dto.js'
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

  toActivationLinkJson(link: IssuedActivationLink): ActivationLinkJson {
    return { url: link.url, expiresAt: link.expiresAt.toISOString() }
  },

  toMeJson(me: Me): MeJson {
    return {
      ...UserPresenter.toJson(me.user),
      isSuperAdmin: me.isSuperAdmin,
      memberships: me.memberships,
    }
  },
}
