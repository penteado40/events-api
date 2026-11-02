import type { GroupActivationLink, GroupUser } from '../application/ports/group-user-accounts.js'
import type { GroupMember } from '../domain/group-member.js'
import type { Group } from '../domain/group.entity.js'
import type { ActivationLinkJson, GroupJson, GroupMemberJson } from './dto/group.dto.js'

export const GroupPresenter = {
  toJson(group: Group): GroupJson {
    return { id: group.id, name: group.name, createdAt: group.createdAt.toISOString() }
  },

  toMemberJson(member: GroupMember, user: GroupUser): GroupMemberJson {
    return {
      groupId: member.groupId,
      role: member.role,
      user: { id: user.id, name: user.name, email: user.email, isPending: user.isPending },
    }
  },

  toActivationLinkJson(link: GroupActivationLink): ActivationLinkJson {
    return { url: link.url, expiresAt: link.expiresAt.toISOString() }
  },
}
