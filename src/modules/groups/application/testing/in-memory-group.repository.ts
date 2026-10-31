import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { Group, type NewGroupProps } from '../../domain/group.entity.js'
import { GroupRepository } from '../../domain/group.repository.js'

export class InMemoryGroupRepository extends GroupRepository {
  private readonly groups = new Map<number, Group>()
  private nextId = 1

  async findById(id: number): Promise<Group | null> {
    return this.groups.get(id) ?? null
  }

  async findAll(): Promise<Group[]> {
    return byName([...this.groups.values()])
  }

  async findManyByIds(ids: number[]): Promise<Group[]> {
    return byName(ids.flatMap((id) => this.groups.get(id) ?? []))
  }

  async create(props: NewGroupProps, stamp: Stamp): Promise<Group> {
    const group = Group.restore({
      id: this.nextId++,
      name: props.name.value,
      ...createdWith(stamp),
    })
    this.groups.set(group.id, group)
    return group
  }

  async save(group: Group): Promise<void> {
    this.groups.set(group.id, group)
  }

  all(): Group[] {
    return [...this.groups.values()]
  }
}

function byName(groups: Group[]): Group[] {
  return groups.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}
