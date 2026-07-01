import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
import User from "@/lib/models/User"

export const dynamic = "force-dynamic"

/** Admin auction browser with status filter, bids, and winners. */
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
    if (status === "active" || status === "closed") filter.status = status

    const [total, auctions, activeCount, closedCount] = await Promise.all([
      Auction.countDocuments(filter),
      Auction.find(filter)
        .sort({ endsAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Auction.countDocuments({ status: "active" }),
      Auction.countDocuments({ status: "closed" }),
    ])

    const winnerIds = auctions.map((a) => String(a.highestBidderId)).filter(Boolean)
    const winners = await User.find({ _id: { $in: winnerIds } }).select("username").lean()
    const winnerMap = new Map(winners.map((u) => [String(u._id), u.username]))

    const now = Date.now()
    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: { active: activeCount, closed: closedCount },
      auctions: auctions.map((a) => ({
        id: String(a._id),
        itemName: a.itemName,
        startingPrice: a.startingPrice,
        currentPrice: a.currentPrice,
        bids: Array.isArray(a.bids) ? a.bids.length : 0,
        status: a.status,
        ended: new Date(a.endsAt).getTime() < now,
        winner: a.highestBidderId ? winnerMap.get(String(a.highestBidderId)) || "—" : "",
        endsAt: a.endsAt,
        createdAt: a.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/auctions error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
