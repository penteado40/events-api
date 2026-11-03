import type { GroupRoster } from './group-roster.js'

/**
 * The Group members of a Group, read and written as one aggregate. Writes are
 * serialized per Group (ADR-0014): inside a UnitOfWork, `lockByGroup` takes the
 * Group's lock and only then reads, so the rules judge the current Roster.
 */
export abstract class GroupRosterRepository {
  /** The roster of the Group, without a lock (to answer who may act); null when the Group does not exist. */
  abstract findByGroup(groupId: number): Promise<GroupRoster | null>
  /**
   * Locks the Group until the running UnitOfWork ends, then reads its roster;
   * a concurrent writer waits here. Null when the Group does not exist.
   */
  abstract lockByGroup(groupId: number): Promise<GroupRoster | null>
  /** Writes the roster's changes atomically; a User already in the Group is ALREADY_A_GROUP_MEMBER. */
  abstract save(roster: GroupRoster): Promise<void>
}
