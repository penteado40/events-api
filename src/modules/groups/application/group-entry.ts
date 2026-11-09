import type { Stamp } from '../../../shared/domain/stamp.js'
import type { Group } from '../domain/group.entity.js'
import type { GroupMailer, GroupMailInviter } from './ports/group-mailer.js'
import type {
  GroupActivationLink,
  GroupUser,
  GroupUserAccounts,
} from './ports/group-user-accounts.js'

/**
 * The one email of an entry into a Group: the Activation link of a Group for
 * the Pending user born now, the Group access for an active User. A Pending
 * user who already had a link gets none: there is nothing new for them to open.
 */
export function emailEntry(
  mailer: GroupMailer,
  group: Group,
  user: GroupUser,
  activationLink: GroupActivationLink | null,
  inviter: GroupMailInviter,
  stamp: Stamp,
): void {
  const to = { email: user.email, name: user.name }
  if (activationLink) {
    mailer.sendActivationLink({ name: group.name }, to, activationLink, inviter, stamp)
  } else if (!user.isPending) {
    mailer.sendGroupAccess({ name: group.name }, to, inviter, stamp)
  }
}

/** A Pending user born for nothing keeps no usable link (ADR-0014). */
export async function dropLink(
  accounts: GroupUserAccounts,
  userId: number,
  what: 'Owner' | 'Viewer',
  cause: unknown,
): Promise<void> {
  try {
    await accounts.dropPendingActivation(userId)
  } catch (dropError) {
    throw new AggregateError(
      [cause, dropError],
      `Gravação do ${what} falhou e o Activation link do User ${userId} ficou aberto: revogue-o no Clerk`,
      { cause: dropError },
    )
  }
}
