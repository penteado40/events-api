import { beforeEach, describe, expect, it } from 'vitest'
import { FakeBackgroundTasks } from '../../../shared/application/testing/fake-background-tasks.js'
import { FixedClock } from '../../../shared/application/testing/fixed-clock.js'
import { AccountEmails } from './account-emails.js'
import { FakeEmailSender } from './testing/fake-email-sender.js'
import { InMemoryEmailLogRepository } from './testing/in-memory-email-log.repository.js'

const NOW = new Date('2026-11-01T15:00:00.000Z')
const STAMP = { by: 1, at: new Date('2026-11-01T14:59:59.000Z') }
const LINK = {
  url: 'https://accounts.clerk.test/accept?invitation=inv_1',
  expiresAt: new Date('2026-11-08T15:00:00.000Z'),
}

describe('AccountEmails', () => {
  let sender: FakeEmailSender
  let log: InMemoryEmailLogRepository
  let background: FakeBackgroundTasks
  let emails: AccountEmails

  beforeEach(() => {
    sender = new FakeEmailSender()
    log = new InMemoryEmailLogRepository()
    background = new FakeBackgroundTasks()
    emails = new AccountEmails(sender, log, background, new FixedClock(NOW), {
      platformName: 'Programação',
      fromAddress: 'noreply@mail.example.com',
    })
  })

  it('sends the Activation link from the Platform sender, with only the platform name and no replyTo', async () => {
    emails.sendActivationLink({ email: 'pedro@example.com', name: 'Pedro' }, LINK, STAMP)
    await background.settle()

    expect(sender.sent).toHaveLength(1)
    const [email] = sender.sent
    expect(email?.from).toEqual({ name: 'Programação', address: 'noreply@mail.example.com' })
    expect(email?.to).toBe('pedro@example.com')
    expect(email).not.toHaveProperty('replyTo')
  })

  it('writes the fixed pt-BR text of the Activation link, with the link and its expiry', async () => {
    emails.sendActivationLink({ email: 'pedro@example.com', name: 'Pedro' }, LINK, STAMP)
    await background.settle()

    const [email] = sender.sent
    expect(email?.subject).toBe('Ative sua conta na Programação')
    expect(email?.text).toBe(
      [
        'Olá, Pedro!',
        '',
        'Sua conta na Programação foi criada. Para entrar pela primeira vez, abra o link abaixo e defina uma senha ou use a sua conta Google ou Apple deste email:',
        '',
        'https://accounts.clerk.test/accept?invitation=inv_1',
        '',
        'O link vale até 08/11/2026 às 12:00 (horário de Brasília). Se ele expirar, peça um novo a quem criou a sua conta.',
      ].join('\n'),
    )
    expect(email?.html).toContain('href="https://accounts.clerk.test/accept?invitation=inv_1"')
  })

  it('escapes the name in the html', async () => {
    emails.sendActivationLink({ email: 'pedro@example.com', name: '<b>Pedro</b>' }, LINK, STAMP)
    await background.settle()

    expect(sender.sent[0]?.html).toContain('Olá, &lt;b&gt;Pedro&lt;/b&gt;!')
  })

  it('records the attempt as SENT in the Email log, by the Author of the stamp', async () => {
    emails.sendActivationLink({ email: 'pedro@example.com', name: 'Pedro' }, LINK, STAMP)
    await background.settle()

    expect(log.all()).toEqual([
      {
        kind: 'ACCOUNT_ACTIVATION_LINK',
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

  it('records a provider failure as FAILED with the error, without throwing', async () => {
    sender.failNextSend()

    expect(() =>
      emails.sendActivationLink({ email: 'pedro@example.com', name: 'Pedro' }, LINK, STAMP),
    ).not.toThrow()
    await background.settle()

    expect(sender.sent).toEqual([])
    expect(background.errors).toEqual([])
    expect(log.all()).toMatchObject([
      {
        kind: 'ACCOUNT_ACTIVATION_LINK',
        recipient: 'pedro@example.com',
        status: 'FAILED',
        error: 'fake email sender: send failed',
      },
    ])
  })
})
