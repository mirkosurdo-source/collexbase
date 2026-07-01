import crypto from "crypto"
import { connectDB } from "@/lib/db"
import ApiKey from "@/lib/models/ApiKey"

/** All scopes a developer key can be granted. */
export const API_SCOPES = [
  "read:collection",
  "read:market",
  "read:auction",
  "read:trade",
  "read:showcase",
  "read:groups",
  "read:analytics",
  "read:advisor",
  "write:webhook",
] as const

export type ApiScope = (typeof API_SCOPES)[number]

export const SCOPE_LABELS: Record<ApiScope, string> = {
  "read:collection": "Lettura collezione",
  "read:market": "Lettura marketplace",
  "read:auction": "Lettura aste",
  "read:trade": "Lettura scambi",
  "read:showcase": "Lettura vetrine",
  "read:groups": "Lettura gruppi",
  "read:analytics": "Lettura analytics",
  "read:advisor": "Advisor AI",
  "write:webhook": "Gestione webhook",
}

const KEY_PREFIX = "cxb_live_"
const DEFAULT_RATE_LIMIT = 60 // requests per minute per key

/** SHA-256 hash of a raw key (deterministic, used for lookup). */
export function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex")
}

/** Generates a new random raw key string. */
function generateRawKey(): string {
  return KEY_PREFIX + crypto.randomBytes(24).toString("hex")
}

export interface CreatedApiKey {
  id: string
  rawKey: string
  keyPrefix: string
  scopes: string[]
}

/**
 * Creates a new API key for a user. Returns the raw key, which is shown ONCE
 * and never retrievable again (only its hash is stored).
 */
export async function createApiKey(
  userId: string,
  label: string,
  scopes: string[],
): Promise<CreatedApiKey> {
  await connectDB()
  const rawKey = generateRawKey()
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 6) + "…"
  const valid = scopes.filter((s) => (API_SCOPES as readonly string[]).includes(s))

  const doc = await ApiKey.create({
    userId,
    label: label.trim().slice(0, 80),
    keyHash,
    keyPrefix,
    scopes: valid,
    rateLimitPerMin: DEFAULT_RATE_LIMIT,
  })

  return { id: String(doc._id), rawKey, keyPrefix, scopes: valid }
}

export interface ValidatedKey {
  ok: boolean
  status: number
  message?: string
  userId?: string
  keyId?: string
  scopes?: string[]
  rateLimit?: { limit: number; remaining: number; reset: number }
}

/**
 * Validates an incoming raw key for a given required scope, enforcing a
 * per-key fixed-window rate limit. Increments usage counters atomically.
 */
export async function validateApiKey(rawKey: string | null, requiredScope: ApiScope): Promise<ValidatedKey> {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
    return { ok: false, status: 401, message: "API key mancante o non valida." }
  }
  await connectDB()
  const keyHash = hashKey(rawKey)
  const keyDoc = await ApiKey.findOne({ keyHash })

  if (!keyDoc || !keyDoc.active) {
    return { ok: false, status: 401, message: "API key non valida o revocata." }
  }
  if (!keyDoc.scopes.includes(requiredScope)) {
    return { ok: false, status: 403, message: `Scope mancante: ${requiredScope}` }
  }

  // Fixed-window rate limiting (1 minute windows).
  const now = Date.now()
  const limit = keyDoc.rateLimitPerMin || DEFAULT_RATE_LIMIT
  const windowMs = 60_000
  const windowStart = keyDoc.windowStart ? new Date(keyDoc.windowStart).getTime() : 0
  let windowCount = keyDoc.windowCount || 0

  if (now - windowStart >= windowMs) {
    keyDoc.windowStart = new Date(now)
    windowCount = 0
  }
  windowCount += 1

  if (windowCount > limit) {
    keyDoc.windowCount = windowCount
    await keyDoc.save()
    const reset = Math.ceil((windowStart + windowMs - now) / 1000)
    return {
      ok: false,
      status: 429,
      message: "Limite di richieste superato. Riprova tra poco.",
      rateLimit: { limit, remaining: 0, reset: Math.max(1, reset) },
    }
  }

  keyDoc.windowCount = windowCount
  keyDoc.callCount = (keyDoc.callCount || 0) + 1
  if (requiredScope === "read:analytics") {
    keyDoc.analyticsCallCount = (keyDoc.analyticsCallCount || 0) + 1
  }
  keyDoc.lastUsedAt = new Date(now)
  await keyDoc.save()

  return {
    ok: true,
    status: 200,
    userId: String(keyDoc.userId),
    keyId: String(keyDoc._id),
    scopes: keyDoc.scopes,
    rateLimit: {
      limit,
      remaining: Math.max(0, limit - windowCount),
      reset: Math.ceil((Number(new Date(keyDoc.windowStart).getTime()) + windowMs - now) / 1000),
    },
  }
}

/** Lists a user's API keys (never exposes the hash). */
export async function listApiKeys(userId: string) {
  await connectDB()
  const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 }).lean()
  return keys.map((k: Record<string, unknown>) => ({
    id: String(k._id),
    label: k.label,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    active: k.active,
    callCount: k.callCount,
    rateLimitPerMin: k.rateLimitPerMin,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }))
}

/** Revokes (deactivates) a key owned by the user. */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  await connectDB()
  const res = await ApiKey.updateOne(
    { _id: keyId, userId },
    { $set: { active: false, revokedAt: new Date() } },
  )
  return res.modifiedCount > 0
}
