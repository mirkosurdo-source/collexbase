import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"

export const dynamic = "force-dynamic"

/** Admin trade browser. Maps statuses: pending=attivi, accepted=completati, rejected=annullati. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const status = url.searchParams.get("status") || ""
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20

    const filter: Record<string, unknown> = {}
    if (["pending", "accepted", "rejected"].includes(status)) filter.status = status

    const [total, trades, counts] = await Promise.all([
      Trade.countDocuments(filter),
      Trade.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Trade.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ])

    const countMap: Record<string, number> = {}
    for (const c of counts as { _id: string; count: number }[]) countMap[c._id] = c.count

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: countMap,
      trades: trades.map((t) => ({
        id: String(t._id),
        from: t.fromUsername || "—",
        to: t.toUsername || "—",
        offeredItem: t.offeredItemName || "",
        requestedItem: t.requestedItemName || "",
        status: t.status,
        messages: Array.isArray(t.messages) ? t.messages.length : 0,
        createdAt: t.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/trades error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
