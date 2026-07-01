import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import Webhook from "@/lib/models/Webhook"
import { WEBHOOK_EVENTS, generateWebhookSecret } from "@/lib/webhooks"

function serialize(w: Record<string, unknown>) {
  return {
    id: String(w._id),
    url: w.url,
    events: w.events,
    secret: w.secret,
    active: w.active,
    deliveredCount: w.deliveredCount,
    failureStreak: w.failureStreak,
    lastDeliveryAt: w.lastDeliveryAt,
    lastError: w.lastError,
    disabledReason: w.disabledReason,
    deliveries: w.deliveries,
    createdAt: w.createdAt,
  }
}

// GET /api/developer/webhooks — list the current user's webhooks.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  try {
    await connectDB()
    const hooks = await Webhook.find({ userId }).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ success: true, webhooks: hooks.map(serialize) })
  } catch (err) {
    console.error("[v0] developer/webhooks GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

// POST /api/developer/webhooks — create a webhook subscription.
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string; events?: string[] }
    const url = (body.url || "").trim()
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ success: false, message: "URL non valido (http/https)." }, { status: 400 })
    }
    const events = Array.isArray(body.events)
      ? body.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e))
      : []
    if (events.length === 0) {
      return NextResponse.json({ success: false, message: "Seleziona almeno un evento." }, { status: 400 })
    }
    await connectDB()
    const hook = await Webhook.create({ userId, url, events, secret: generateWebhookSecret() })
    return NextResponse.json({ success: true, webhook: serialize(hook.toObject()) }, { status: 201 })
  } catch (err) {
    console.error("[v0] developer/webhooks POST error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
