import crypto from "crypto"
import { connectDB } from "@/lib/db"
import Webhook from "@/lib/models/Webhook"

/** All events a webhook can subscribe to (Blocco 38). */
export const WEBHOOK_EVENTS = [
  "market.new",
  "market.sold",
  "auction.new",
  "auction.bid",
  "trade.proposed",
  "trade.completed",
  "collection.updated",
  "showcase.updated",
  "group.posted",
  "moderation.flagged",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

const MAX_FAILURES = 10
const MAX_ATTEMPTS = 3
const MAX_DELIVERY_LOG = 20

/** Generates a random webhook signing secret. */
export function generateWebhookSecret(): string {
  return "whsec_" + crypto.randomBytes(24).toString("hex")
}

/** Computes the HMAC-SHA256 signature for a payload body. */
export function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface DeliveryResult {
  ok: boolean
  status: number
  error: string
  attempts: number
}

/**
 * Sends a single signed POST to a webhook URL with retry + exponential backoff.
 * Never throws — returns a structured delivery result.
 */
async function deliver(url: string, secret: string, event: string, data: unknown): Promise<DeliveryResult> {
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data })
  const signature = signPayload(secret, body)
  let lastStatus = 0
  let lastError = ""

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-collexbase-event": event,
          "x-collexbase-signature": `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      lastStatus = res.status
      if (res.ok) return { ok: true, status: res.status, error: "", attempts: attempt }
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : "network error"
      lastStatus = 0
    }
    if (attempt < MAX_ATTEMPTS) await delay(2 ** attempt * 250) // 500ms, 1s backoff
  }

  return { ok: false, status: lastStatus, error: lastError, attempts: MAX_ATTEMPTS }
}

/** Appends a delivery log entry and updates streak/auto-disable state on a doc. */
function recordDelivery(doc: Record<string, any>, event: string, result: DeliveryResult) {
  doc.deliveries = [
    { event, status: result.status, ok: result.ok, error: result.error, attempts: result.attempts, at: new Date() },
    ...(doc.deliveries || []),
  ].slice(0, MAX_DELIVERY_LOG)
  doc.lastDeliveryAt = new Date()

  if (result.ok) {
    doc.deliveredCount = (doc.deliveredCount || 0) + 1
    doc.failureStreak = 0
    doc.lastError = ""
  } else {
    doc.failureStreak = (doc.failureStreak || 0) + 1
    doc.lastError = result.error
    if (doc.failureStreak >= MAX_FAILURES) {
      doc.active = false
      doc.disabledReason = `Disattivato automaticamente dopo ${MAX_FAILURES} consegne fallite.`
    }
  }
}

/**
 * Emits an event to all active webhooks subscribed to it. Additive: existing
 * engines are unaffected; callers opt in by importing this function.
 * Optionally scope to a single owner via `userId`.
 */
export async function emitWebhookEvent(event: WebhookEvent, data: unknown, userId?: string): Promise<number> {
  try {
    await connectDB()
    const filter: Record<string, unknown> = { active: true, events: event }
    if (userId) filter.userId = userId
    const hooks = await Webhook.find(filter)
    let delivered = 0
    await Promise.all(
      hooks.map(async (hook: Record<string, any>) => {
        const result = await deliver(hook.url, hook.secret, event, data)
        recordDelivery(hook, event, result)
        if (result.ok) delivered += 1
        await hook.save()
      }),
    )
    return delivered
  } catch (err) {
    console.error("[v0] emitWebhookEvent error:", err)
    return 0
  }
}

/** Sends a test ping to a single webhook (used by the developer portal). */
export async function testWebhook(hookId: string, userId: string): Promise<DeliveryResult | null> {
  await connectDB()
  const hook = await Webhook.findOne({ _id: hookId, userId })
  if (!hook) return null
  const result = await deliver(hook.url, hook.secret, "test.ping", { message: "Webhook di test da CollexBase." })
  recordDelivery(hook, "test.ping", result)
  await hook.save()
  return result
}
