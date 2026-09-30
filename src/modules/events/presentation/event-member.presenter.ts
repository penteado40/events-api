import type { EventMemberView } from '../application/event-members.js'
import type { IssuedActivationLink } from '../application/ports/member-accounts.js'
import type { ActivationLinkJson, EventMemberJson } from './dto/event-member.dto.js'

export const EventMemberPresenter = {
  toJson({ member, user }: EventMemberView): EventMemberJson {
    return {
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      isPrimaryOwner: member.isPrimaryOwner,
      pending: user.isPending,
    }
  },

  activationLinkToJson(link: IssuedActivationLink): ActivationLinkJson {
    return { activationToken: link.activationToken, expiresAt: link.expiresAt.toISOString() }
  },
}
