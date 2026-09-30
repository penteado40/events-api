import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { as, MEMBER_NOW, memberRows, memberScenario } from '../testing/member-fixtures.js'
import { AddEventMemberUseCase } from './add-event-member.use-case.js'

describe('AddEventMemberUseCase', () => {
  let s: Awaited<ReturnType<typeof memberScenario>>
  let addMember: AddEventMemberUseCase

  beforeEach(async () => {
    s = await memberScenario()
    addMember = new AddEventMemberUseCase(s.events, s.accounts, s.clock)
  })

  it('creates a Pending user for a new email and hands back the Activation link', async () => {
    const result = await addMember.execute({
      actor: as.organizer,
      eventId: s.event.id,
      email: 'joao@x.com',
      name: 'João',
      role: 'MANAGER',
    })

    expect(result.user).toEqual({
      id: 1000,
      name: 'João',
      email: 'joao@x.com',
      isSuperAdmin: false,
      isPending: true,
    })
    expect(result.activation).toEqual({
      activationToken: 'token-1',
      expiresAt: new Date('2026-10-06T12:00:00.000Z'),
    })
    expect([result.member.userId, result.member.role, result.member.isPrimaryOwner]).toEqual([
      1000,
      'MANAGER',
      false,
    ])
    expect([result.member.createdById, result.member.createdAt]).toEqual([11, MEMBER_NOW])
  })

  it('links an existing User without touching them or issuing a link', async () => {
    s.users.add({ id: 30, email: 'joao@x.com', name: 'João', isPending: true })
    s.accounts.links.set(30, 'ana-link')

    const result = await addMember.execute({
      actor: as.primary,
      eventId: s.event.id,
      email: 'joao@x.com',
      name: 'Outro nome',
      role: 'VIEWER',
    })

    expect(result.user.name).toBe('João')
    expect(result.user.isPending).toBe(true)
    expect(result.activation).toBeNull()
    expect(s.accounts.links.get(30)).toBe('ana-link')
  })

  it('lets an Owner add someone straight as an Owner', async () => {
    await addMember.execute({
      actor: as.organizer,
      eventId: s.event.id,
      email: 'user14@example.com',
      name: 'X',
      role: 'OWNER',
    })

    expect(await memberRows(s.events, s.event.id)).toContainEqual([14, 'OWNER', false])
  })

  it('drops the Activation link of a Pending user it just created if the link to the Event fails', async () => {
    vi.spyOn(s.events, 'createMember').mockRejectedValueOnce(new Error('database down'))

    await expect(
      addMember.execute({
        actor: as.organizer,
        eventId: s.event.id,
        email: 'joao@x.com',
        name: 'João',
        role: 'VIEWER',
      }),
    ).rejects.toThrow('database down')
    expect(s.accounts.links.has(1000)).toBe(false)
  })

  it("leaves an existing User's link alone if the link to the Event fails", async () => {
    s.users.add({ id: 30, email: 'joao@x.com', isPending: true })
    s.accounts.links.set(30, 'ana-link')
    vi.spyOn(s.events, 'createMember').mockRejectedValueOnce(new Error('database down'))

    await expect(
      addMember.execute({
        actor: as.organizer,
        eventId: s.event.id,
        email: 'joao@x.com',
        name: 'João',
        role: 'VIEWER',
      }),
    ).rejects.toThrow('database down')
    expect(s.accounts.links.get(30)).toBe('ana-link')
  })

  it('refuses someone who already is a member with MEMBER_ALREADY_EXISTS', async () => {
    await expect(
      addMember.execute({
        actor: as.primary,
        eventId: s.event.id,
        email: 'user12@example.com',
        name: 'X',
        role: 'VIEWER',
      }),
    ).rejects.toEqual(new AppError('MEMBER_ALREADY_EXISTS'))
  })

  it('refuses the Super admin with USER_IS_SUPER_ADMIN', async () => {
    await expect(
      addMember.execute({
        actor: as.primary,
        eventId: s.event.id,
        email: 'admin@example.com',
        name: 'X',
        role: 'OWNER',
      }),
    ).rejects.toEqual(new AppError('USER_IS_SUPER_ADMIN'))
  })

  it('refuses Managers with FORBIDDEN, creating no User', async () => {
    await expect(
      addMember.execute({
        actor: as.manager,
        eventId: s.event.id,
        email: 'new@x.com',
        name: 'X',
        role: 'VIEWER',
      }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(s.users.all().some((u) => u.email === 'new@x.com')).toBe(false)
  })

  it('refuses an Owner on an Archived event with EVENT_ARCHIVED', async () => {
    const event = await s.events.findById(s.event.id)
    event?.archive({ by: 10, at: MEMBER_NOW })

    await expect(
      addMember.execute({
        actor: as.primary,
        eventId: s.event.id,
        email: 'new@x.com',
        name: 'X',
        role: 'VIEWER',
      }),
    ).rejects.toEqual(new AppError('EVENT_ARCHIVED'))
  })
})
