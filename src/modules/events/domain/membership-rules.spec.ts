import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import type { Membership } from './event-member.js'
import { type MemberActor, MembershipRules, type MemberTarget } from './membership-rules.js'

const PRIMARY: Membership = { role: 'OWNER', isPrimaryOwner: true }
const OWNER: Membership = { role: 'OWNER', isPrimaryOwner: false }
const MANAGER: Membership = { role: 'MANAGER', isPrimaryOwner: false }
const VIEWER: Membership = { role: 'VIEWER', isPrimaryOwner: false }

const superAdmin: MemberActor = { userId: 1, isSuperAdmin: true, membership: null }
const primary: MemberActor = { userId: 10, isSuperAdmin: false, membership: PRIMARY }
const organizer: MemberActor = { userId: 11, isSuperAdmin: false, membership: OWNER }
const manager: MemberActor = { userId: 12, isSuperAdmin: false, membership: MANAGER }
const viewer: MemberActor = { userId: 13, isSuperAdmin: false, membership: VIEWER }

const target = (userId: number, membership: Membership): MemberTarget => ({ userId, membership })
const self = (actor: MemberActor): MemberTarget => target(actor.userId, actor.membership!)
const otherOwner = target(20, OWNER)
const otherManager = target(21, MANAGER)
const otherViewer = target(22, VIEWER)
const thePrimary = target(10, PRIMARY)

const FORBIDDEN = new AppError('FORBIDDEN')
const MUST_TRANSFER = new AppError('PRIMARY_OWNER_MUST_TRANSFER')

describe('MembershipRules', () => {
  describe('assertCanAdd', () => {
    it('lets any Owner and the Super admin add Event members, with any role', () => {
      for (const actor of [superAdmin, primary, organizer]) {
        expect(() => MembershipRules.assertCanAdd(actor)).not.toThrow()
      }
    })

    it('refuses Managers and Viewers', () => {
      for (const actor of [manager, viewer]) {
        expect(() => MembershipRules.assertCanAdd(actor)).toThrow(FORBIDDEN)
      }
    })
  })

  describe('assertCanChangeRole', () => {
    it('lets any Owner manage Managers and Viewers and promote them to Owner', () => {
      expect(() =>
        MembershipRules.assertCanChangeRole(organizer, otherManager, 'VIEWER'),
      ).not.toThrow()
      expect(() =>
        MembershipRules.assertCanChangeRole(organizer, otherViewer, 'OWNER'),
      ).not.toThrow()
    })

    it('refuses Managers and Viewers, even on themselves', () => {
      expect(() => MembershipRules.assertCanChangeRole(manager, otherViewer, 'MANAGER')).toThrow(
        FORBIDDEN,
      )
      expect(() => MembershipRules.assertCanChangeRole(viewer, self(viewer), 'OWNER')).toThrow(
        FORBIDDEN,
      )
    })

    it('lets only the Primary owner and the Super admin demote another Owner', () => {
      expect(() => MembershipRules.assertCanChangeRole(organizer, otherOwner, 'MANAGER')).toThrow(
        FORBIDDEN,
      )
      expect(() =>
        MembershipRules.assertCanChangeRole(primary, otherOwner, 'MANAGER'),
      ).not.toThrow()
      expect(() =>
        MembershipRules.assertCanChangeRole(superAdmin, otherOwner, 'VIEWER'),
      ).not.toThrow()
    })

    it('lets an Owner organizador demote themselves', () => {
      expect(() =>
        MembershipRules.assertCanChangeRole(organizer, self(organizer), 'VIEWER'),
      ).not.toThrow()
    })

    it('keeps the Primary owner an Owner until they transfer, even for the Super admin', () => {
      expect(() => MembershipRules.assertCanChangeRole(primary, self(primary), 'MANAGER')).toThrow(
        MUST_TRANSFER,
      )
      expect(() => MembershipRules.assertCanChangeRole(superAdmin, thePrimary, 'VIEWER')).toThrow(
        MUST_TRANSFER,
      )
    })

    it('refuses an Owner organizador touching the Primary owner as forbidden first', () => {
      expect(() => MembershipRules.assertCanChangeRole(organizer, thePrimary, 'VIEWER')).toThrow(
        FORBIDDEN,
      )
    })

    it('accepts setting the role someone already has', () => {
      expect(() =>
        MembershipRules.assertCanChangeRole(primary, self(primary), 'OWNER'),
      ).not.toThrow()
      expect(() =>
        MembershipRules.assertCanChangeRole(organizer, otherOwner, 'OWNER'),
      ).not.toThrow()
    })
  })

  describe('assertCanRemove', () => {
    it('lets every Event member leave on their own', () => {
      for (const actor of [organizer, manager, viewer]) {
        expect(() => MembershipRules.assertCanRemove(actor, self(actor))).not.toThrow()
      }
    })

    it('keeps the Primary owner from leaving before transferring', () => {
      expect(() => MembershipRules.assertCanRemove(primary, self(primary))).toThrow(MUST_TRANSFER)
    })

    it('keeps even the Super admin from removing the Primary owner', () => {
      expect(() => MembershipRules.assertCanRemove(superAdmin, thePrimary)).toThrow(MUST_TRANSFER)
    })

    it('lets any Owner remove Managers and Viewers', () => {
      expect(() => MembershipRules.assertCanRemove(organizer, otherManager)).not.toThrow()
      expect(() => MembershipRules.assertCanRemove(organizer, otherViewer)).not.toThrow()
    })

    it('lets only the Primary owner and the Super admin remove another Owner', () => {
      expect(() => MembershipRules.assertCanRemove(organizer, otherOwner)).toThrow(FORBIDDEN)
      expect(() => MembershipRules.assertCanRemove(primary, otherOwner)).not.toThrow()
      expect(() => MembershipRules.assertCanRemove(superAdmin, otherOwner)).not.toThrow()
    })

    it('refuses Managers and Viewers removing someone else', () => {
      expect(() => MembershipRules.assertCanRemove(manager, otherViewer)).toThrow(FORBIDDEN)
      expect(() => MembershipRules.assertCanRemove(viewer, otherManager)).toThrow(FORBIDDEN)
    })
  })

  describe('assertCanTransferPrimary', () => {
    it('lets the Primary owner and the Super admin hand the post to another Owner', () => {
      expect(() => MembershipRules.assertCanTransferPrimary(primary, otherOwner)).not.toThrow()
      expect(() => MembershipRules.assertCanTransferPrimary(superAdmin, otherOwner)).not.toThrow()
    })

    it('refuses an Owner organizador, a Manager and a Viewer', () => {
      for (const actor of [organizer, manager, viewer]) {
        expect(() => MembershipRules.assertCanTransferPrimary(actor, otherOwner)).toThrow(FORBIDDEN)
      }
    })

    it('refuses an Owner organizador naming themselves (nobody promotes themselves)', () => {
      expect(() => MembershipRules.assertCanTransferPrimary(organizer, self(organizer))).toThrow(
        FORBIDDEN,
      )
    })

    it('hands the post only to someone who already is an Owner', () => {
      for (const to of [otherManager, otherViewer]) {
        expect(() => MembershipRules.assertCanTransferPrimary(primary, to)).toThrow(
          new AppError('TRANSFER_TARGET_NOT_OWNER'),
        )
        expect(() => MembershipRules.assertCanTransferPrimary(superAdmin, to)).toThrow(
          new AppError('TRANSFER_TARGET_NOT_OWNER'),
        )
      }
    })

    it('accepts naming the current Primary owner again', () => {
      expect(() => MembershipRules.assertCanTransferPrimary(primary, self(primary))).not.toThrow()
    })
  })
})
