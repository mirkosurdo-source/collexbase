import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import ApiKey from "@/lib/models/ApiKey"
import Webhook from "@/lib/models/Webhook"
import User from "@/lib/models/User"

export const dynamic = "force-dynamic"

/** Admin monitoring of public API keys: list, usage stats, webhook errors. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const status = url.searchParams.get("status") || "" // active | revoked
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (status === "active") filter.active = true
    if (status === "revoked") filter.active = false

    // Optional username search → resolve to userIds.
    if (q) {
      const users = await User.find({ username: { $regex: q, $options: "i" } })
        .select("_id")
        .limit(100)
        .lean()
      filter.userId = { $in: users.map((u: Record<string, unknown>) => u._id) }
    }

    const [total, keys, totalsAgg, activeCount] = await Promise.all([
      ApiKey.countDocuments(filter),
      ApiKey.find(filter)
        .select("userId label keyPrefix scopes active revokedAt callCount analyticsCallCount lastUsedAt rateLimitPerMin createdAt")
        .sort({ callCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ApiKey.aggregate([
        { $group: { _id: null, totalCalls: { $sum: "$callCount" }, analyticsCalls: { $sum: "$analyticsCallCount" }, keys: { $sum: 1 } } },
      ]),
      ApiKey.countDocuments({ active: true }),
    ])

    // Resolve owner usernames for the listed keys.
    const ownerIds = Array.from(new Set(keys.map((k: Record<string, unknown>) => String(k.userId))))
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select("username")
      .lean()
    const ownerMap = new Map(owners.map((u: Record<string, unknown>) => [String(u._id), u.username]))

    const rows = keys.map((k: Record<string, unknown>) => ({
      id: String(k._id),
      owner: ownerMap.get(String(k.userId)) || "—",
      label: k.label || "—",
      keyPrefix: k.keyPrefix || "",
      scopes: k.scopes || [],
      active: !!k.active,
      callCount: k.callCount || 0,
      analyticsCallCount: k.analyticsCallCount || 0,
      rateLimitPerMin: k.rateLimitPerMin || 60,
      lastUsedAt: k.lastUsedAt || null,
      createdAt: k.createdAt,
    }))

    // Webhooks: count + recent errors across all users.
    const [webhookCount, disabledWebhooks, errorDocs] = await Promise.all([
      Webhook.countDocuments({}),
      Webhook.countDocuments({ active: false }),
      Webhook.find({ $or: [{ failureStreak: { $gt: 0 } }, { active: false }] })
        .select("userId url active failureStreak lastError lastDeliveryAt disabledReason")
        .sort({ failureStreak: -1, lastDeliveryAt: -1 })
        .limit(25)
        .lean(),
    ])

    const whOwnerIds = Array.from(new Set(errorDocs.map((w: Record<string, unknown>) => String(w.userId))))
    const whOwners = await User.find({ _id: { $in: whOwnerIds } })
      .select("username")
      .lean()
    const whOwnerMap = new Map(whOwners.map((u: Record<string, unknown>) => [String(u._id), u.username]))

    const webhookErrors = errorDocs.map((w: Record<string, unknown>) => ({
      id: String(w._id),
      owner: whOwnerMap.get(String(w.userId)) || "—",
      url: w.url,
      active: !!w.active,
      failureStreak: w.failureStreak || 0,
      lastError: w.lastError || "",
      disabledReason: w.disabledReason || "",
      lastDeliveryAt: w.lastDeliveryAt || null,
    }))

    const totals = totalsAgg[0] || { totalCalls: 0, analyticsCalls: 0, keys: 0 }

    return NextResponse.json({
      success: true,
      keys: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        totalKeys: totals.keys,
        activeKeys: activeCount,
        totalCalls: totals.totalCalls,
        analyticsCalls: totals.analyticsCalls,
        totalWebhooks: webhookCount,
        disabledWebhooks,
      },
      webhookErrors,
    })
  } catch (err) {
    console.error("[v0] admin/api-keys GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** Revoke an abusive key by id. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })

    const key = await ApiKey.findById(id)
    if (!key) return NextResponse.json({ success: false, message: "Chiave non trovata." }, { status: 404 })

    key.active = false
    key.revokedAt = new Date()
    await key.save()

    return NextResponse.json({ success: true, message: "Chiave revocata." })
  } catch (err) {
    console.error("[v0] admin/api-keys DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
