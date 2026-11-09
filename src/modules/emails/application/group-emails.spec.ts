import { beforeEach, describe, expect, it } from 'vitest'
import { FakeBackgroundTasks } from '../../../shared/application/testing/fake-background-tasks.js'
import { FixedClock } from '../../../shared/application/testing/fixed-clock.js'
import { GroupEmails } from './group-emails.js'
import { FakeEmailSender } from './testing/fake-email-sender.js'
import { InMemoryEmailLogRepository } from './testing/in-memory-email-log.repository.js'

const NOW = new Date('2026-11-01T15:00:00.000Z')
const STAMP = { by: 1, at: new Date('2026-11-01T14:59:59.000Z') }
const GROUP = { name: 'Vocal Livre' }
const INVITER = { email: 'admin@example.com' }
const LINK = {
  url: 'https://accounts.clerk.test/accept?invitation=inv_1',
  expiresAt: new Date('2026-11-08T15:00:00.000Z'),
}

describe('GroupEmails', () => {
  let sender: FakeEmailSender
  let log: InMemoryEmailLogRepository
  let background: FakeBackgroundTasks
  let emails: GroupEmails

  beforeEach(() => {
    sender = new FakeEmailSender()
    log = new InMemoryEmailLogRepository()
    background = new FakeBackgroundTasks()
    emails = new GroupEmails(sender, log, background, new FixedClock(NOW), {
      platformName: 'Programação',
      fromAddress: 'noreply@mail.example.com',
    })
  })

  describe('sendActivationLink', () => {
    it('sends from "<Group> via <Plataforma>", replying to who made the action', async () => {
      emails.sendActivationLink(
        GROUP,
        { email: 'pedro@example.com', name: 'Pedro' },
        LINK,
        INVITER,
        STAMP,
      )
      await background.settle()

      expect(sender.sent).toHaveLength(1)
      const [email] = sender.sent
      expect(email?.from).toEqual({
        name: 'Vocal Livre via Programação',
        address: 'noreply@mail.example.com',
      })
      expect(email?.replyTo).toBe('admin@example.com')
      expect(email?.to).toBe('pedro@example.com')
    })

    it('writes the fixed pt-BR text with the Group name, the link and its expiry', async () => {
      emails.sendActivationLink(
        GROUP,
        { email: 'pedro@example.com', name: 'Pedro' },
        LINK,
        INVITER,
        STAMP,
      )
      await background.settle()

      const [email] = sender.sent
      expect(email?.subject).toBe('Você foi adicionado ao grupo Vocal Livre')
      expect(email?.text).toBe(
        [
          'Olá, Pedro!',
          '',
          'Você foi adicionado ao grupo Vocal Livre na Programação. Para entrar pela primeira vez, abra o link abaixo e defina uma senha ou use a sua conta Google ou Apple deste email:',
          '',
          'https://accounts.clerk.test/accept?invitation=inv_1',
          '',
          'O link vale até 08/11/2026 às 12:00 (horário de Brasília). Se ele expirar, peça um novo a quem adicionou você ao grupo.',
        ].join('\n'),
      )
      expect(email?.html).toContain('href="https://accounts.clerk.test/accept?invitation=inv_1"')
    })

    it('escapes the Group and the person in the html', async () => {
      emails.sendActivationLink(
        { name: '<i>Vocal</i>' },
        { email: 'pedro@example.com', name: '<b>Pedro</b>' },
        LINK,
        INVITER,
        STAMP,
      )
      await background.settle()

      expect(sender.sent[0]?.html).toContain('Olá, &lt;b&gt;Pedro&lt;/b&gt;!')
      expect(sender.sent[0]?.html).toContain('grupo &lt;i&gt;Vocal&lt;/i&gt; na')
    })

    it('records GROUP_ACTIVATION_LINK as SENT in the Email log, by the Author of the stamp', async () => {
      emails.sendActivationLink(
        GROUP,
        { email: 'pedro@example.com', name: 'Pedro' },
        LINK,
        INVITER,
        STAMP,
      )
      await background.settle()

      expect(log.all()).toEqual([
        {
          kind: 'GROUP_ACTIVATION_LINK',
          recipient: 'pedro@example.com',
          status: 'SENT',
          error: null,
          createdAt: NOW,
          updatedAt: NOW,
          createdById: 1,
          updatedById: 1,
        },
      ])
    })

    it('records the failure in the Email log without throwing', async () => {
      sender.failNextSend()

      emails.sendActivationLink(
        GROUP,
        { email: 'pedro@example.com', name: 'Pedro' },
        LINK,
        INVITER,
        STAMP,
      )
      await expect(background.settle()).resolves.not.toThrow()

      expect(log.all()).toMatchObject([
        {
          kind: 'GROUP_ACTIVATION_LINK',
          status: 'FAILED',
          error: 'fake email sender: send failed',
        },
      ])
    })
  })

  describe('sendGroupAccess', () => {
    it('sends from "<Group> via <Plataforma>", replying to who made the action', async () => {
      emails.sendGroupAccess(GROUP, { email: 'pedro@example.com', name: 'Pedro' }, INVITER, STAMP)
      await background.settle()

      expect(sender.sent).toHaveLength(1)
      const [email] = sender.sent
      expect(email?.from).toEqual({
        name: 'Vocal Livre via Programação',
        address: 'noreply@mail.example.com',
      })
      expect(email?.replyTo).toBe('admin@example.com')
      expect(email?.to).toBe('pedro@example.com')
    })

    it('writes the fixed pt-BR text with the Group name and no Activation link', async () => {
      emails.sendGroupAccess(GROUP, { email: 'pedro@example.com', name: 'Pedro' }, INVITER, STAMP)
      await background.settle()

      const [email] = sender.sent
      expect(email?.subject).toBe('Você foi adicionado ao grupo Vocal Livre')
      expect(email?.text).toBe(
        [
          'Olá, Pedro!',
          '',
          'Você foi adicionado ao grupo Vocal Livre na Programação. Abra o app e entre com a sua conta para acessar o grupo.',
        ].join('\n'),
      )
      expect(email?.html).not.toContain('href=')
    })

    it('escapes the Group and the person in the html', async () => {
      emails.sendGroupAccess(
        { name: '<i>Vocal</i>' },
        { email: 'pedro@example.com', name: '<b>Pedro</b>' },
        INVITER,
        STAMP,
      )
      await background.settle()

      expect(sender.sent[0]?.html).toContain('Olá, &lt;b&gt;Pedro&lt;/b&gt;!')
      expect(sender.sent[0]?.html).toContain('grupo &lt;i&gt;Vocal&lt;/i&gt; na')
    })

    it('records GROUP_ACCESS as SENT in the Email log, and a failure as FAILED without throwing', async () => {
      emails.sendGroupAccess(GROUP, { email: 'pedro@example.com', name: 'Pedro' }, INVITER, STAMP)
      sender.failNextSend()
      emails.sendGroupAccess(GROUP, { email: 'bia@example.com', name: 'Bia' }, INVITER, STAMP)
      await background.settle()

      expect(log.all()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'GROUP_ACCESS',
            recipient: 'pedro@example.com',
            status: 'SENT',
          }),
          expect.objectContaining({
            kind: 'GROUP_ACCESS',
            recipient: 'bia@example.com',
            status: 'FAILED',
          }),
        ]),
      )
      expect(background.errors).toEqual([])
    })
  })
})
