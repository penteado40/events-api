import type { Stamp } from '../../../shared/domain/stamp.js'
import type { Group, NewGroupProps } from './group.entity.js'

export abstract class GroupRepository {
  abstract findById(id: number): Promise<Group | null>
  /** Every Group, by name. */
  abstract findAll(): Promise<Group[]>
  /** The Groups with these ids, by name; ids with no Group are left out. */
  abstract findManyByIds(ids: number[]): Promise<Group[]>
  abstract create(props: NewGroupProps, stamp: Stamp): Promise<Group>
  abstract save(group: Group): Promise<void>
}
