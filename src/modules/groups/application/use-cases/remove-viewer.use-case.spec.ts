import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { FakeEventPublisher } from '../../../../shared/application/testing/fake-event-publisher.js'
import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { GroupName } from '../../domain/group-name.vo.js'
import { FakeGroupUserAccounts } from '../testing/fake-group-user-accounts.js'
import { ANA, SCRIPT_STAMP, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { InMemoryGroupRosterRepository } from '../testing/in-memory-group-roster.repository.js'
import { RemoveViewerUseCase } from './remove-viewer.use-case.js'

const NOW = new Date('2026-11-09T12:00:00.000Z')

describe('RemoveViewerUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let accounts: FakeGroupUserAccounts
  let events: FakeEventPublisher
  let rosters: InMemoryGroupRosterRepository
  let unitOfWork: InMemoryUnitOfWork
  let removeViewer: RemoveViewerUseCase

  beforeEach(async () => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    accounts = new FakeGroupUserAccounts(NOW)
    events = new FakeEventPublisher()
    rosters = new InMemoryGroupRosterRepository(groups, members)
    unitOfWork = new InMemoryUnitOfWork()
    removeViewer = new RemoveViewerUseCase(
      rosters,
      members,
      events,
      unitOfWork,
      new FixedClock(NOW),
    )
    await groups.create({ name: GroupName.create('Vocal Livre') }, SCRIPT_STAMP)
    members.add({ groupId: 1, userId: ANA.id, role: 'OWNER' })
  })

  it('lets an Owner take a Viewer out, under the lock, and publishes GroupMemberRemoved', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
    members.add({ groupId: 1, userId: joao.id, role: 'VIEWER' })

    await removeViewer.execute({ actor: ANA, groupId: 1, userId: joao.id })

    expect(members.all()).toEqual([{ groupId: 1, userId: ANA.id, role: 'OWNER' }])
    expect(rosters.locks()).toEqual([1])
    expect(events.published()).toEqual([
      { type: 'GroupMemberRemoved', groupId: 1, userId: joao.id, occurredAt: NOW },
    ])
  })

  it('lets the Super admin take a Viewer out of any Group', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
    members.add({ groupId: 1, userId: joao.id, role: 'VIEWER' })

    await removeViewer.execute({ actor: SUPER_ADMIN, groupId: 1, userId: joao.id })

    expect(members.ofGroup(1)).toHaveLength(1)
    expect(events.published()).toHaveLength(1)
  })

  it('refuses a Viewer, even for themselves, with FORBIDDEN, publishing nothing', async () => {
    const joao = accounts.existing({ email: 'joao@x.com', name: 'João' })
    members.add({ groupId: 1, userId: joao.id, role: 'VIEWER' })

    await expect(
      removeViewer.execute({
        actor: { id: joao.id, isSuperAdmin: false },
        groupId: 1,
        userId: joao.id,
      }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(members.ofGroup(1)).toHaveLength(2)
    expect(rosters.locks()).toEqual([])
    expect(events.published()).toEqual([])
  })

  it('answers NOT_FOUND to who is not a Group member, and for a missing Group', async () => {
    const caio = { id: 9, isSuperAdmin: false }

    await expect(removeViewer.execute({ actor: caio, groupId: 1, userId: 5 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(
      removeViewer.execute({ actor: SUPER_ADMIN, groupId: 42, userId: 5 }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('answers NOT_FOUND for an Owner or for who is no Group member: this route takes only Viewers', async () => {
    await expect(
      removeViewer.execute({ actor: SUPER_ADMIN, groupId: 1, userId: ANA.id }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
    await expect(removeViewer.execute({ actor: ANA, groupId: 1, userId: 77 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    expect(events.published()).toEqual([])
  })
})
