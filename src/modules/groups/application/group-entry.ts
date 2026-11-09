import type { Stamp } from '../../../shared/domain/stamp.js'
import type { GroupRole } from '../domain/group-member.js'
import type { Group } from '../domain/group.entity.js'
import type { GroupMailer, GroupMailInviter } from './ports/group-mailer.js'
import type { EnsuredGroupUser, GroupUserAccounts } from './ports/group-user-accounts.js'

/**
 * The one email of an entry into a Group: the Activation link of a Group for
 * the Pending user born now, the Group access for anyone else, including a
 * Pending user who already had a link (there is no new link to send them).
 */
export function emailEntry(
  mailer: GroupMailer,
  group: Group,
  { user, activationLink }: EnsuredGroupUser,
  inviter: GroupMailInviter,
  stamp: Stamp,
): void {
  const to = { email: user.email, name: user.name }
  if (activationLink) {
    mailer.sendActivationLink({ name: group.name }, to, activationLink, inviter, stamp)
  } else {
    mailer.sendGroupAccess({ name: group.name }, to, inviter, stamp)
  }
}

/** A Pending user born for nothing keeps no usable link (ADR-0014). */
export async function dropLink(
  accounts: GroupUserAccounts,
  userId: number,
  role: GroupRole,
  cause: unknown,
): Promise<void> {
  try {
    await accounts.dropPendingActivation(userId)
  } catch (dropError) {
    throw new AggregateError(
      [cause, dropError],
      `Gravação do ${role === 'OWNER' ? 'Owner' : 'Viewer'} falhou e o Activation link do User ${userId} ficou aberto: revogue-o no Clerk`,
      { cause: dropError },
    )
  }
}
