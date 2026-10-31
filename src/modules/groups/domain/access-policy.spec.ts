import { describe, expect, it } from 'vitest'
import { type Actor, AccessPolicy } from './access-policy.js'

const SUPER_ADMIN: Actor = { userId: 1, isSuperAdmin: true, membership: new Map() }
const NOBODY: Actor = { userId: 2, isSuperAdmin: false, membership: new Map() }
const OWNER_OF_10: Actor = { userId: 3, isSuperAdmin: false, membership: new Map([[10, 'OWNER']]) }
const VIEWER_OF_10: Actor = {
  userId: 4,
  isSuperAdmin: false,
  membership: new Map([[10, 'VIEWER']]),
}

describe('AccessPolicy', () => {
  describe('createGroup', () => {
    it('allows only the Super admin', () => {
      expect(AccessPolicy.can(SUPER_ADMIN, { type: 'createGroup' })).toBe(true)
      expect(AccessPolicy.can(NOBODY, { type: 'createGroup' })).toBe(false)
      expect(AccessPolicy.can(OWNER_OF_10, { type: 'createGroup' })).toBe(false)
      expect(AccessPolicy.can(VIEWER_OF_10, { type: 'createGroup' })).toBe(false)
    })
  })

  describe('listAllGroups', () => {
    it('allows only the Super admin', () => {
      expect(AccessPolicy.can(SUPER_ADMIN, { type: 'listAllGroups' })).toBe(true)
      expect(AccessPolicy.can(NOBODY, { type: 'listAllGroups' })).toBe(false)
      expect(AccessPolicy.can(OWNER_OF_10, { type: 'listAllGroups' })).toBe(false)
      expect(AccessPolicy.can(VIEWER_OF_10, { type: 'listAllGroups' })).toBe(false)
    })
  })

  describe('viewGroup', () => {
    it('allows the Super admin in any Group', () => {
      expect(AccessPolicy.can(SUPER_ADMIN, { type: 'viewGroup', groupId: 10 })).toBe(true)
    })

    it('allows an Owner or a Viewer of the Group', () => {
      expect(AccessPolicy.can(OWNER_OF_10, { type: 'viewGroup', groupId: 10 })).toBe(true)
      expect(AccessPolicy.can(VIEWER_OF_10, { type: 'viewGroup', groupId: 10 })).toBe(true)
    })

    it('refuses who is not a Group member of that Group', () => {
      expect(AccessPolicy.can(NOBODY, { type: 'viewGroup', groupId: 10 })).toBe(false)
      expect(AccessPolicy.can(OWNER_OF_10, { type: 'viewGroup', groupId: 11 })).toBe(false)
    })
  })

  describe('renameGroup', () => {
    it('allows only the Super admin, not even an Owner of the Group', () => {
      expect(AccessPolicy.can(SUPER_ADMIN, { type: 'renameGroup', groupId: 10 })).toBe(true)
      expect(AccessPolicy.can(OWNER_OF_10, { type: 'renameGroup', groupId: 10 })).toBe(false)
      expect(AccessPolicy.can(VIEWER_OF_10, { type: 'renameGroup', groupId: 10 })).toBe(false)
    })
  })
})
