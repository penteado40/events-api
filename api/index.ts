// Vercel Functions entry (Node.js runtime, not Edge). The app is created once per
// instance and reused across invocations. Deployment is validated in PROJ-53.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from '../src/bootstrap.js'

type Handler = (req: IncomingMessage, res: ServerResponse) => void

let handler: Promise<Handler> | undefined

async function init(): Promise<Handler> {
  const app = await createApp()
  await app.init()
  return app.getHttpAdapter().getInstance() as Handler
}

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  handler ??= init()
  const handle = await handler
  handle(req, res)
}
