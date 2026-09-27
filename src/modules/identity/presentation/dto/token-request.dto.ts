import { z } from 'zod'

/**
 * OAuth2 password grant body (RFC 6749 §4.3). Parsed by hand in the controller,
 * because its errors follow the RFC and not the `{ error: { code } }` envelope.
 */
export const TokenRequestSchema = z.object({
  grant_type: z.string(),
  username: z.string(),
  password: z.string(),
})
