import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import User from "@/lib/models/User"
import Reputation from "@/lib/models/Reputation"
import Follow from "@/lib/models/Follow"
import Escrow from "@/lib/models/Escrow"
import AIMetadata from "@/lib/models/AIMetadata"

export const dynamic = "force-dynamic"

interface Row {
  userId: string
  name: string
  username: string
  avatar: string
  value: number
}

/** Resolves a list of userIds to display rows, preserving the input order. */
async function decorate(entries: { userId: string; value: number }[]): Promise<Row[]> {
  const ids = entries.map((e) => e.userId).filter(Boolean)
  const objIds = ids.map((id) => {
    try {
      return new Types.ObjectId(id)
    } catch {
      return null
    }
  })
  const users = await User.find({ _id: { $in: objIds.filter(Boolean) } })
    .select("name username avatar")
    .lean()
  const map = new Map(users.map((u) => [String(u._id), u]))
  return entries.map((e) => {
    const u = map.get(e.userId)
    return {
      userId: e.userId,
      name: u?.name ?? "Utente",
      username: u?.username ?? "",
      avatar: u?.avatar ?? "",
      value: e.value,
    }
  })
}

/**
 * Blocco 27 — admin reputation overview: leaderboards (reputation, follower,
 * vendite, valutazioni AI) + community growth chart (nuovi utenti per mese).
 * Read-only aggregation over existing data.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()

    const [topReputationRaw, topFollowedRaw, topSalesRaw, topAiRaw, growthRaw, totals] = await Promise.all([
      Reputation.find({}).select("userId score tier").sort({ score: -1 }).limit(10).lean(),
      Follow.aggregate([
        { $group: { _id: "$sellerId", value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: 10 },
      ]),
      Escrow.aggregate([
        { $match: { status: "released" } },
        { $group: { _id: "$sellerId", value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: 10 },
      ]),
      AIMetadata.aggregate([
        { $group: { _id: "$userId", value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: 10 },
      ]),
      User.aggregate([
        {
          $group: {
            _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
            value: { $sum: 1 },
          },
        },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
        { $limit: 12 },
      ]),
      Promise.all([User.countDocuments({}), Reputation.countDocuments({})]),
    ])

    const [topReputation, topFollowed, topSales, topAi] = await Promise.all([
      decorate(topReputationRaw.map((r) => ({ userId: String(r.userId), value: r.score }))),
      decorate(topFollowedRaw.map((r) => ({ userId: String(r._id), value: r.value }))),
      decorate(topSalesRaw.map((r) => ({ userId: String(r._id), value: r.value }))),
      decorate(topAiRaw.map((r) => ({ userId: String(r._id), value: r.value }))),
    ])

    const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
    const growth = growthRaw.map((g: { _id: { y: number; m: number }; value: number }) => ({
      label: `${MONTHS[(g._id.m || 1) - 1]} ${String(g._id.y).slice(2)}`,
      value: g.value,
    }))

    return NextResponse.json({
      success: true,
      totals: { users: totals[0], withReputation: totals[1] },
      leaderboards: { topReputation, topFollowed, topSales, topAi },
      growth,
    })
  } catch (err) {
    console.error("[v0] admin/reputation error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
