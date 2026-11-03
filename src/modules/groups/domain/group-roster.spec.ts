import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import type { GroupMember } from './group-member.js'
import { GroupRoster } from './group-roster.js'

const STAMP = { by: 1, at: new Date('2026-11-02T12:00:00.000Z') }

function owner(userId: number): GroupMember {
  return { groupId: 10, userId, role: 'OWNER' }
}
function viewer(userId: number): GroupMember {
  return { groupId: 10, userId, role: 'VIEWER' }
}
function rosterOf(members: GroupMember[], hasHadOwner = true): GroupRoster {
  return GroupRoster.restore({ groupId: 10, hasHadOwner, members })
}

describe('GroupRoster', () => {
  describe('removeOwner', () => {
    it('removes an Owner while another Owner stays', () => {
      const roster = rosterOf([owner(2), owner(3), viewer(4)])

      roster.removeOwner(2)

      expect(roster.members).toEqual([owner(3), viewer(4)])
      expect(roster.changes()).toMatchObject({ removed: [2], roleChanges: [] })
    })

    it('refuses to remove the last Owner with LAST_OWNER, even with Viewers left', () => {
      const roster = rosterOf([owner(2), viewer(4)])

      expect(() => roster.removeOwner(2)).toThrow(new AppError('LAST_OWNER'))
      expect(roster.members).toEqual([owner(2), viewer(4)])
      expect(roster.changes()).toMatchObject({ removed: [], roleChanges: [] })
    })

    it('answers NOT_FOUND for a Viewer or someone not in the Group', () => {
      const roster = rosterOf([owner(2), owner(3), viewer(4)])

      expect(() => roster.removeOwner(4)).toThrow(new AppError('NOT_FOUND'))
      expect(() => roster.removeOwner(99)).toThrow(new AppError('NOT_FOUND'))
    })
  })

  describe('demoteOwner', () => {
    it('makes an Owner a Viewer while another Owner stays', () => {
      const roster = rosterOf([owner(2), owner(3)])

      const member = roster.demoteOwner(2, STAMP)

      expect(member).toEqual(viewer(2))
      expect(roster.members).toEqual([viewer(2), owner(3)])
      expect(roster.changes().roleChanges).toEqual([{ member: viewer(2), stamp: STAMP }])
    })

    it('refuses to demote the last Owner with LAST_OWNER', () => {
      const roster = rosterOf([owner(2), viewer(4)])

      expect(() => roster.demoteOwner(2, STAMP)).toThrow(new AppError('LAST_OWNER'))
      expect(roster.members).toEqual([owner(2), viewer(4)])
      expect(roster.changes().roleChanges).toEqual([])
    })

    it('answers NOT_FOUND for a Viewer or someone not in the Group', () => {
      const roster = rosterOf([owner(2), owner(3), viewer(4)])

      expect(() => roster.demoteOwner(4, STAMP)).toThrow(new AppError('NOT_FOUND'))
      expect(() => roster.demoteOwner(99, STAMP)).toThrow(new AppError('NOT_FOUND'))
    })
  })

  describe('promoteToOwner', () => {
    it('makes a Viewer an Owner', () => {
      const roster = rosterOf([owner(2), viewer(4)])

      const member = roster.promoteToOwner(4, STAMP)

      expect(member).toEqual(owner(4))
      expect(roster.members).toEqual([owner(2), owner(4)])
      expect(roster.changes()).toMatchObject({
        roleChanges: [{ member: owner(4), stamp: STAMP }],
        firstOwner: null,
      })
    })

    it('leaves an Owner as they are, with nothing to write', () => {
      const roster = rosterOf([owner(2)])

      expect(roster.promoteToOwner(2, STAMP)).toEqual(owner(2))
      expect(roster.changes().roleChanges).toEqual([])
    })

    it('answers NOT_FOUND for someone not in the Group', () => {
      expect(() => rosterOf([owner(2)]).promoteToOwner(99, STAMP)).toThrow(
        new AppError('NOT_FOUND'),
      )
    })
  })

  describe('a Group born without an Owner', () => {
    it('gets its first Owner by promoting a Viewer, and then never goes without one', () => {
      const roster = rosterOf([viewer(4)], false)

      roster.promoteToOwner(4, STAMP)

      expect(roster.hasHadOwner).toBe(true)
      expect(roster.changes().firstOwner).toEqual(STAMP)
      expect(() => roster.demoteOwner(4, STAMP)).toThrow(new AppError('LAST_OWNER'))
    })

    it('has no Owner to remove or demote', () => {
      const roster = rosterOf([viewer(4)], false)

      expect(() => roster.removeOwner(4)).toThrow(new AppError('NOT_FOUND'))
      expect(() => roster.demoteOwner(4, STAMP)).toThrow(new AppError('NOT_FOUND'))
    })
  })

  describe('two Owners leaving, read from the same state', () => {
    it('lets only the first go: the second sees the first already gone', () => {
      const roster = rosterOf([owner(2), owner(3)])

      roster.removeOwner(2)

      expect(() => roster.removeOwner(3)).toThrow(new AppError('LAST_OWNER'))
      expect(roster.members).toEqual([owner(3)])
    })
  })

  describe('leave and demoteSelf', () => {
    it('let an Owner step down while another Owner stays', () => {
      const roster = rosterOf([owner(2), owner(3), owner(5)])

      roster.leave(2)
      expect(roster.demoteSelf(3, STAMP)).toEqual(viewer(3))

      expect(roster.members).toEqual([viewer(3), owner(5)])
    })

    it('refuse a Viewer with FORBIDDEN and someone not in the Group with NOT_FOUND', () => {
      const roster = rosterOf([owner(2), owner(3), viewer(4)])

      expect(() => roster.leave(4)).toThrow(new AppError('FORBIDDEN'))
      expect(() => roster.demoteSelf(4, STAMP)).toThrow(new AppError('FORBIDDEN'))
      expect(() => roster.leave(99)).toThrow(new AppError('NOT_FOUND'))
    })

    it('refuse the last Owner with LAST_OWNER', () => {
      const roster = rosterOf([owner(2), viewer(4)])

      expect(() => roster.leave(2)).toThrow(new AppError('LAST_OWNER'))
      expect(() => roster.demoteSelf(2, STAMP)).toThrow(new AppError('LAST_OWNER'))
    })
  })
})
