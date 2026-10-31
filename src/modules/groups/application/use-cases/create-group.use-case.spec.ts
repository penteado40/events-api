import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { ANA, SUPER_ADMIN } from '../testing/groups-fixtures.js'
import { InMemoryGroupMemberRepository } from '../testing/in-memory-group-member.repository.js'
import { InMemoryGroupRepository } from '../testing/in-memory-group.repository.js'
import { CreateGroupUseCase } from './create-group.use-case.js'

const NOW = new Date('2026-10-31T12:00:00.000Z')

describe('CreateGroupUseCase', () => {
  let groups: InMemoryGroupRepository
  let members: InMemoryGroupMemberRepository
  let createGroup: CreateGroupUseCase

  beforeEach(() => {
    groups = new InMemoryGroupRepository()
    members = new InMemoryGroupMemberRepository()
    createGroup = new CreateGroupUseCase(groups, members, new FixedClock(NOW))
  })

  it('creates a Group with the trimmed name and no Group members', async () => {
    const group = await createGroup.execute({ actor: SUPER_ADMIN, name: '  Vocal Livre  ' })

    expect(group.name).toBe('Vocal Livre')
    expect(groups.all()).toHaveLength(1)
    expect(members.all()).toEqual([])
  })

  it('records the Super admin as the Author', async () => {
    const group = await createGroup.execute({ actor: SUPER_ADMIN, name: 'Vocal Livre' })

    expect(group.createdById).toBe(1)
    expect(group.updatedById).toBe(1)
    expect(group.createdAt).toEqual(NOW)
    expect(group.updatedAt).toEqual(NOW)
  })

  it('refuses a User who is not the Super admin with FORBIDDEN, creating nothing', async () => {
    await expect(createGroup.execute({ actor: ANA, name: 'Vocal Livre' })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(groups.all()).toEqual([])
  })
})
