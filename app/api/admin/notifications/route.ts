import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Notification from "@/lib/models/Notification"

export const dynamic = "force-dynamic"

const TYPES = ["chat", "trade", "marketplace", "auction", "payment", "escrow", "moderation", "message", "system"]

/**
 * Admin notifications audit. Intentionally privacy-aware: it surfaces volume,
 * type breakdown and per-record metadata (recipient id, context, read state)
 * but never the notification title/body, so admins can audit generation
 * without invasively reading users' personal notifications.
 *
 * Views (`?view=`):
 *  - summary (default): totals, by-type counts, 14-day daily volume.
 *  - list: paginated metadata feed, filterable by `?type=`.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "summary"

    if (view === "list") {
      const type = url.searchParams.get("type") || ""
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
      const limit = 25
      const skip = (page - 1) * limit

      const filter: Record<string, unknown> = {}
      if (type && TYPES.includes(type)) filter.type = type

      const total = await Notification.countDocuments(filter)
      const rows = await Notification.find(filter)
        .select("userId type context read deleted createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()

      return NextResponse.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        items: rows.map((r) => ({
          id: String(r._id),
          userId: String(r.userId),
          type: r.type,
          contextKind: r.context?.kind || null,
          read: !!r.read,
          deleted: !!r.deleted,
          createdAt: r.createdAt,
        })),
      })
    }

    // Default: summary.
    const total = await Notification.countDocuments({})
    const unread = await Notification.countDocuments({ read: false, deleted: { $ne: true } })
    const deleted = await Notification.countDocuments({ deleted: true })

    const byTypeAgg = await Notification.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }])
    const byTypeMap = new Map<string, number>(byTypeAgg.map((d) => [String(d._id), d.count as number]))
    const byType = TYPES.map((t) => ({ category: t, value: byTypeMap.get(t) || 0 }))

    // 14-day daily volume.
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 13)
    const dailyAgg = await Notification.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ])
    const dailyMap = new Map<string, number>(dailyAgg.map((d) => [String(d._id), d.count as number]))
    const daily: { label: string; value: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      daily.push({ label: key.slice(5), value: dailyMap.get(key) || 0 })
    }

    return NextResponse.json({
      success: true,
      total,
      unread,
      deleted,
      byType,
      daily,
      // We don't persist generation errors; they are logged server-side and
      // never throw (createNotification is fire-and-forget). Surfaced as 0.
      generationErrors: 0,
    })
  } catch (err) {
    console.error("[v0] admin/notifications error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
