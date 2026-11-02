import { Webhook } from 'svix'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, TEST_WEBHOOK_SIGNING_SECRET, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createUser } from './support/factories.js'

const PATH = '/api/v1/webhooks/clerk'
const UNAUTHENTICATED = { error: { code: 'UNAUTHENTICATED', message: expect.any(String) } }

let sequence = 0

/** The body and Svix headers of a webhook as Clerk sends it, signed with `secret`. */
function clerkWebhook(payload: unknown, secret = TEST_WEBHOOK_SIGNING_SECRET) {
  sequence += 1
  const body = JSON.stringify(payload)
  const id = `msg_test_${sequence}`
  const timestamp = new Date()
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'svix-signature': new Webhook(secret).sign(id, timestamp, body),
    },
  }
}

function userUpdated(clerkId: string, profile: { first: string; last: string; email: string }) {
  return {
    type: 'user.updated',
    object: 'event',
    data: {
      id: clerkId,
      first_name: profile.first,
      last_name: profile.last,
      primary_email_address_id: 'idn_primary',
      email_addresses: [
        {
          id: 'idn_primary',
          email_address: profile.email,
          verification: { status: 'verified' },
        },
      ],
    },
  }
}

describe('POST /api/v1/webhooks/clerk', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  function send({ body, headers }: { body: string; headers: Record<string, string> }) {
    return t.http().post(PATH).set(headers).send(body)
  }

  async function stored(userId: number) {
    return testPrisma().user.findUniqueOrThrow({ where: { id: userId } })
  }

  it('mirrors the name and email of the linked User, with no Author', async () => {
    const user = await createUser({ name: 'Ana', email: 'ana@example.com', clerkId: 'user_ana' })

    const res = await send(
      clerkWebhook(
        userUpdated('user_ana', { first: 'Ana', last: 'Souza', email: 'ana.souza@example.com' }),
      ),
    )

    expect(res.status).toBe(200)
    const row = await stored(user.id)
    expect(row.name).toBe('Ana Souza')
    expect(row.email).toBe('ana.souza@example.com')
    expect(row.updatedById).toBeNull()
    expect(row.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime())
  })

  it.each([
    [
      'no signature',
      (w: ReturnType<typeof clerkWebhook>) => ({
        ...w,
        headers: { 'content-type': 'application/json' },
      }),
    ],
    [
      'a signature of another secret',
      () =>
        clerkWebhook(
          userUpdated('user_caio', { first: 'Eva', last: 'Forjada', email: 'eva@example.com' }),
          `whsec_${Buffer.from('a-secret-clerk-never-gave-us!!!!').toString('base64')}`,
        ),
    ],
    [
      'a body changed after signing',
      (w: ReturnType<typeof clerkWebhook>) => ({
        ...w,
        body: w.body.replace('Caio', 'Eva'),
      }),
    ],
  ])('answers 401 to %s, changing nothing', async (_case, tamper) => {
    const user = await createUser({
      name: 'Caio',
      email: `caio${sequence}@example.com`,
      clerkId: `user_caio_${sequence}`,
    })
    const genuine = clerkWebhook(
      userUpdated(user.clerkId!, { first: 'Caio', last: 'Lima', email: 'caio.lima@example.com' }),
    )

    const res = await send(tamper(genuine))

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
    const row = await stored(user.id)
    expect(row.name).toBe('Caio')
    expect(row.updatedAt).toEqual(user.updatedAt)
  })

  it('answers 200 to an unknown Clerk user, creating nothing', async () => {
    const before = await testPrisma().user.count()

    const res = await send(
      clerkWebhook(
        userUpdated('user_nobody', { first: 'Ninguém', last: 'Aqui', email: 'nobody@example.com' }),
      ),
    )

    expect(res.status).toBe(200)
    expect(await testPrisma().user.count()).toBe(before)
    expect(
      await testPrisma().user.findUnique({ where: { email: 'nobody@example.com' } }),
    ).toBeNull()
  })

  it('answers 200 to an event of another type, with no effect', async () => {
    const user = await createUser({ name: 'Duda', clerkId: 'user_duda' })

    const res = await send(
      clerkWebhook({
        type: 'user.deleted',
        object: 'event',
        data: { id: 'user_duda', deleted: true },
      }),
    )

    expect(res.status).toBe(200)
    expect(await stored(user.id)).toEqual(user)
  })

  it('mirrors only the name when another User already has the new email', async () => {
    await createUser({ email: 'taken@example.com' })
    const user = await createUser({ name: 'Edu', email: 'edu@example.com', clerkId: 'user_edu' })

    const res = await send(
      clerkWebhook(
        userUpdated('user_edu', { first: 'Edu', last: 'Reis', email: 'taken@example.com' }),
      ),
    )

    expect(res.status).toBe(200)
    const row = await stored(user.id)
    expect(row.name).toBe('Edu Reis')
    expect(row.email).toBe('edu@example.com')
  })
})
