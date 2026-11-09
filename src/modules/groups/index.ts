// Public API of the groups context. Other modules import only from here.
export { GroupsModule } from './groups.module.js'
export {
  type GroupMemberRemoved,
  groupMemberRemoved,
} from './domain/events/group-member-removed.event.js'
