import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import BoostActivation from "@/lib/models/BoostActivation"
import { BOOST_EFFECTS } from "@/lib/boost"
import type { BoostTier } from "@/lib/models/BoostActivation"

export const dynamic = "force-dynamic"

/** Admin boost moderation: search, filter by type/status, paginate, stats. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const targetType = url.searchParams.get("targetType") || ""
    const status = url.searchParams.get("status") || "" // active | expired | disabled
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (["marketplace", "auction", "trade", "showcase"].includes(targetType)) filter.targetType = targetType
    if (status === "active") {
      filter.disabled = { $ne: true }
      filter.endsAt = { $gt: new Date() }
    } else if (status === "expired") {
      filter.endsAt = { $lte: new Date() }
    } else if (status === "disabled") {
      filter.disabled = true
    }
    if (q) filter.targetId = { $regex: q, $options: "i" }

    const [total, docs, totals, typeAgg] = await Promise.all([
      BoostActivation.countDocuments(filter),
      BoostActivation.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BoostActivation.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            coins: { $sum: "$coinsSpent" },
            active: {
              $sum: { $cond: [{ $and: [{ $ne: ["$disabled", true] }, { $gt: ["$endsAt", new Date()] }] }, 1, 0] },
            },
          },
        },
      ]),
      BoostActivation.aggregate([{ $group: { _id: "$targetType", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ])

    // Resolve usernames in a single query.
    const userIds = [...new Set((docs as Record<string, unknown>[]).map((d) => String(d.userId)).filter(Boolean))]
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select("username").lean() : []
    const userMap = new Map(users.map((u) => [String(u._id), u.username as string]))

    const now = Date.now()
    const rows = (docs as Record<string, unknown>[]).map((b) => {
      const endsAt = new Date(b.endsAt as string)
      const disabled = Boolean(b.disabled)
      const expired = endsAt.getTime() <= now
      return {
        id: String(b._id),
        username: userMap.get(String(b.userId)) || "—",
        targetType: b.targetType,
        targetId: String(b.targetId),
        tier: b.tier,
        label: BOOST_EFFECTS[b.tier as BoostTier]?.label ?? String(b.tier),
        coinsSpent: Number(b.coinsSpent || 0),
        visibilityPct: Number(b.visibilityPct || 0),
        status: disabled ? "disabled" : expired ? "expired" : "active",
        endsAt: b.endsAt,
        createdAt: b.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      boosts: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        total: totals[0]?.total ?? 0,
        coins: totals[0]?.coins ?? 0,
        active: totals[0]?.active ?? 0,
        topType: typeAgg[0]?._id ?? "—",
      },
    })
  } catch (err) {
    console.error("[v0] admin/boost GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** Disable or re-enable a boost without deleting the audit record. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || "")
    if (!id || typeof body.disabled !== "boolean") {
      return NextResponse.json({ success: false, message: "Parametri non validi." }, { status: 400 })
    }
    const res = await BoostActivation.updateOne({ _id: id }, { $set: { disabled: body.disabled } })
    if (!res.matchedCount) return NextResponse.json({ success: false, message: "Boost non trovato." }, { status: 404 })
    return NextResponse.json({ success: true, message: body.disabled ? "Boost disattivato." : "Boost riattivato." })
  } catch (err) {
    console.error("[v0] admin/boost PATCH error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
