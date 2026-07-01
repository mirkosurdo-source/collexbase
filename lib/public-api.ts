import { NextResponse } from "next/server"
import { extractToken } from "@/lib/auth/request"
import { validateApiKey, type ApiScope, type ValidatedKey } from "@/lib/api-keys"

/** Throwable error that maps to a specific HTTP status in a public handler. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

export interface PublicApiContext {
  userId: string
  keyId: string
  scopes: string[]
  rateLimit: { limit: number; remaining: number; reset: number }
}

function rateLimitHeaders(rl?: { limit: number; remaining: number; reset: number }): Record<string, string> {
  if (!rl) return {}
  return {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.reset),
  }
}

/**
 * Wraps a public API route handler with API-key authentication, scope
 * enforcement, and per-key rate limiting. The raw key is taken from the
 * `Authorization: Bearer <key>` header.
 */
export async function withApiKey(
  req: Request,
  scope: ApiScope,
  handler: (ctx: PublicApiContext) => Promise<unknown>,
): Promise<NextResponse> {
  let validated: ValidatedKey
  try {
    validated = await validateApiKey(extractToken(req), scope)
  } catch (err) {
    console.error("[v0] public-api validate error:", err)
    return NextResponse.json({ ok: false, error: "Errore del server." }, { status: 500 })
  }

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.message },
      { status: validated.status, headers: rateLimitHeaders(validated.rateLimit) },
    )
  }

  try {
    const data = await handler({
      userId: validated.userId!,
      keyId: validated.keyId!,
      scopes: validated.scopes!,
      rateLimit: validated.rateLimit!,
    })
    return NextResponse.json({ ok: true, data }, { headers: rateLimitHeaders(validated.rateLimit) })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status, headers: rateLimitHeaders(validated.rateLimit) },
      )
    }
    console.error("[v0] public-api handler error:", err)
    const message = err instanceof Error ? err.message : "Errore del server."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Clamps a page-size query param to a safe range. */
export function clampLimit(value: string | null, def = 20, max = 100): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(max, Math.floor(n))
}
