import type { TestApp } from './app.js'

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> }
}

/**
 * `METHOD /path` of every route Express knows, with `:id` written as `{id}` like
 * the OpenAPI. Reads the router of Express 5 (`app.router`); revisit on upgrade.
 */
export function registeredRoutes(t: TestApp): string[] {
  const express = t.app.getHttpAdapter().getInstance() as { router: { stack: ExpressLayer[] } }
  return express.router.stack.flatMap(({ route }) =>
    route
      ? Object.keys(route.methods).map(
          (method) => `${method.toUpperCase()} ${route.path.replace(/:(\w+)/g, '{$1}')}`,
        )
      : [],
  )
}
