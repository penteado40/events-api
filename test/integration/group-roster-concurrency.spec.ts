import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LeaveGroupUseCase } from '../../src/modules/groups/application/use-cases/leave-group.use-case.js'
import { GroupRosterRepository } from '../../src/modules/groups/domain/group-roster.repository.js'
import { AppError } from '../../src/shared/domain/app-error.js'
import { PrismaUnitOfWork } from '../../src/shared/infrastructure/prisma-unit-of-work.js'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createGroup, createGroupMember, createUser } from './support/factories.js'

/** Whether the promise is still pending after `ms`. */
async function stillPending(promise: Promise<unknown>, ms: number): Promise<boolean> {
  const pending = Symbol('pending')
  const settled = promise.then(
    () => 'settled',
    () => 'settled',
  )
  const winner = await Promise.race([
    settled,
    new Promise((resolve) => setTimeout(() => resolve(pending), ms)),
  ])
  return winner === pending
}

/**
 * Writes on a Group's members are serialized by the Group's row (ADR-0014):
 * a second writer waits for the lock and judges the Roster the first one left,
 * so two Owners leaving at once never leave the Group without an Owner.
 */
describe('Serialized writes on Group members (ADR-0014)', () => {
  let t: TestApp
  let unitOfWork: PrismaUnitOfWork
  let rosters: GroupRosterRepository
  let leave: LeaveGroupUseCase
  let groupId: number
  let ana: { id: number; isSuperAdmin: false }
  let bia: { id: number; isSuperAdmin: false }

  beforeAll(async () => {
    t = await createTestApp()
    unitOfWork = t.app.get(PrismaUnitOfWork)
    rosters = t.app.get(GroupRosterRepository)
    leave = t.app.get(LeaveGroupUseCase)
  })

  beforeEach(async () => {
    groupId = (await createGroup()).id
    await testPrisma().group.update({ where: { id: groupId }, data: { hasHadOwner: true } })
    ana = { id: (await createUser()).id, isSuperAdmin: false }
    bia = { id: (await createUser()).id, isSuperAdmin: false }
    await createGroupMember({ groupId, userId: ana.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: bia.id, role: 'OWNER' })
  })

  afterAll(() => t.close())

  async function owners() {
    const rows = await testPrisma().groupMember.findMany({ where: { groupId, role: 'OWNER' } })
    return rows.map((m) => m.userId)
  }

  it('makes the second Owner leaving wait for the first, then answers LAST_OWNER', async () => {
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let locked!: () => void
    const hasLock = new Promise<void>((resolve) => (locked = resolve))

    // Ana leaves, holding the Group's lock until told to finish.
    const anaLeaves = unitOfWork.run(async () => {
      const roster = await rosters.lockByGroup(groupId)
      locked()
      await released
      roster!.removeOwner(ana.id)
      await rosters.save(roster!)
    })
    await hasLock

    const biaLeaves = leave.execute({ actor: bia, groupId })
    expect(await stillPending(biaLeaves, 300)).toBe(true)

    release()
    await anaLeaves
    await expect(biaLeaves).rejects.toEqual(new AppError('LAST_OWNER'))
    expect(await owners()).toEqual([bia.id])
  })

  it('lets only one of two Owners leaving at the same time go', async () => {
    const results = await Promise.allSettled([
      leave.execute({ actor: ana, groupId }),
      leave.execute({ actor: bia, groupId }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: new AppError('LAST_OWNER'),
    })
    expect(await owners()).toHaveLength(1)
  })

  it('rolls the whole unit back when it fails after a write', async () => {
    await expect(
      unitOfWork.run(async () => {
        const roster = await rosters.lockByGroup(groupId)
        roster!.removeOwner(ana.id)
        await rosters.save(roster!)
        throw new Error('fails after the write')
      }),
    ).rejects.toThrow('fails after the write')

    expect((await owners()).sort()).toEqual([ana.id, bia.id].sort())
  })

  it('refuses to lock outside a unit of work, where the lock would not hold', async () => {
    await expect(rosters.lockByGroup(groupId)).rejects.toThrow(/UnitOfWork\.run/)
  })
})
