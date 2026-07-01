import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import ModerationEvent from "@/lib/models/ModerationEvent"

export const dynamic = "force-dynamic"

/**
 * Blocco 37 — admin moderation events: search, filter by target type /
 * severity / status, paginate, plus aggregate stats and activity chart data.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const targetType = url.searchParams.get("targetType") || ""
    const severity = url.searchParams.get("severity") || ""
    const status = url.searchParams.get("status") || "" // "open" | "resolved" | ""
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { reason: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ]
    }
    if (targetType) filter.targetType = targetType
    if (severity) filter.severity = severity
    if (status === "open") filter.resolved = false
    if (status === "resolved") filter.resolved = true

    // Activity over the last 14 days for the chart.
    const since = new Date()
    since.setDate(since.getDate() - 13)
    since.setHours(0, 0, 0, 0)

    const [total, events, openCount, criticalOpen, bySeverity, byType, daily] = await Promise.all([
      ModerationEvent.countDocuments(filter),
      ModerationEvent.find(filter)
        .select("userId username targetType targetId severity category reason excerpt aiScore autoActioned resolved resolution createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ModerationEvent.countDocuments({ resolved: false }),
      ModerationEvent.countDocuments({ resolved: false, severity: "critical" }),
      ModerationEvent.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
      ModerationEvent.aggregate([{ $group: { _id: "$targetType", count: { $sum: 1 } } }]),
      ModerationEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ])

    const severityMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const s of bySeverity) severityMap[String(s._id)] = s.count

    const typeChart = byType.map((t) => ({ category: String(t._id), value: t.count }))

    // Fill the 14-day series so the chart has no gaps.
    const dailyMap = new Map<string, number>()
    for (const d of daily) dailyMap.set(String(d._id), d.count)
    const series: { label: string; value: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      series.push({ label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }), value: dailyMap.get(key) || 0 })
    }

    const rows = events.map((e) => ({
      id: String(e._id),
      userId: String(e.userId),
      username: e.username || "—",
      targetType: e.targetType,
      targetId: e.targetId || "",
      severity: e.severity,
      category: e.category,
      reason: e.reason || "",
      excerpt: e.excerpt || "",
      aiScore: e.aiScore || 0,
      autoActioned: Boolean(e.autoActioned),
      resolved: Boolean(e.resolved),
      resolution: e.resolution || null,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({
      success: true,
      events: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        total: await ModerationEvent.estimatedDocumentCount(),
        open: openCount,
        criticalOpen,
        bySeverity: severityMap,
      },
      typeChart,
      series,
    })
  } catch (err) {
    console.error("[v0] admin/moderation GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
