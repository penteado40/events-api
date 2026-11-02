import type { GroupRoster } from './group-roster.js'

/** The Group members of a Group, read and written as one aggregate. */
export abstract class GroupRosterRepository {
  /** The roster of the Group; null when the Group does not exist. */
  abstract findByGroup(groupId: number): Promise<GroupRoster | null>
  /** Writes the roster's changes atomically; a User already in the Group is ALREADY_A_GROUP_MEMBER. */
  abstract save(roster: GroupRoster): Promise<void>
}
