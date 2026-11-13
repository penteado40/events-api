import { describe, expect, it } from 'vitest'
import { FakeBackgroundTasks } from '../application/testing/fake-background-tasks.js'
import type { DomainEvent } from '../domain/domain-event.js'
import { InProcessEventPublisher } from './in-process-event-publisher.js'

const AT = new Date('2026-11-09T12:00:00.000Z')
const ping = (n: number): DomainEvent & { n: number } => ({ type: 'Ping', n, occurredAt: AT })
const pong = (): DomainEvent => ({ type: 'Pong', occurredAt: AT })

describe('InProcessEventPublisher', () => {
  function setup() {
    const tasks = new FakeBackgroundTasks()
    const failures: { error: unknown; event: DomainEvent }[] = []
    const publisher = new InProcessEventPublisher(tasks, (error, event) =>
      failures.push({ error, event }),
    )
    return { tasks, publisher, failures }
  }

  it('delivers nothing before the background tasks run, and nothing for a type with no handler', async () => {
    const { publisher, tasks } = setup()
    const seen: string[] = []
    publisher.on('Ping', async () => void seen.push('ping'))

    publisher.publish([pong()])
    await tasks.settle()

    expect(seen).toEqual([])
  })

  it('delivers the events in order, each to its handlers in the order they subscribed', async () => {
    const { publisher, tasks } = setup()
    const seen: string[] = []
    publisher.on('Ping', async (e) => {
      await Promise.resolve()
      seen.push(`first:${(e as ReturnType<typeof ping>).n}`)
    })
    publisher.on('Ping', async (e) => void seen.push(`second:${(e as ReturnType<typeof ping>).n}`))

    publisher.publish([ping(1), pong(), ping(2)])
    await tasks.settle()

    expect(seen).toEqual(['first:1', 'second:1', 'first:2', 'second:2'])
  })

  it('isolates a handler that fails: the next one still runs and the error is reported', async () => {
    const { publisher, tasks, failures } = setup()
    const seen: string[] = []
    const boom = new Error('boom')
    publisher.on('Ping', async () => {
      throw boom
    })
    publisher.on('Ping', () => {
      throw new Error('sync boom')
    })
    publisher.on('Ping', async () => void seen.push('third'))

    publisher.publish([ping(1), ping(2)])
    await tasks.settle()

    expect(seen).toEqual(['third', 'third'])
    expect(failures.map((f) => f.error)).toEqual([
      boom,
      new Error('sync boom'),
      boom,
      new Error('sync boom'),
    ])
    expect(failures[0]?.event).toMatchObject({ type: 'Ping', n: 1 })
    expect(tasks.errors).toEqual([])
  })

  it('stops delivering to a handler that unsubscribed', async () => {
    const { publisher, tasks } = setup()
    const seen: string[] = []
    const off = publisher.on('Ping', async () => void seen.push('a'))
    publisher.on('Ping', async () => void seen.push('b'))
    off()

    publisher.publish([ping(1)])
    await tasks.settle()

    expect(seen).toEqual(['b'])
  })

  it('hands nothing to the background for an empty list', async () => {
    const { publisher, tasks } = setup()
    let ran = false
    publisher.on('Ping', async () => void (ran = true))

    publisher.publish([])
    await tasks.settle()

    expect(ran).toBe(false)
  })
})
