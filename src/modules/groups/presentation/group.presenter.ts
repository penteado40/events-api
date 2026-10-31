import type { Group } from '../domain/group.entity.js'
import type { GroupJson } from './dto/group.dto.js'

export const GroupPresenter = {
  toJson(group: Group): GroupJson {
    return { id: group.id, name: group.name, createdAt: group.createdAt.toISOString() }
  },
}
