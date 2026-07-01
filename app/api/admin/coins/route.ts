import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import CollexCoinBalance from "@/lib/models/CollexCoinBalance"
import CollexCoinTransaction from "@/lib/models/CollexCoinTransaction"

export const dynamic = "force-dynamic"

/** Lists Collex Coin balances (top holders) and the most recent global ledger. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1)
    const limit = 20

    const total = await CollexCoinBalance.countDocuments({})
    const balances = await CollexCoinBalance.find({})
      .sort({ balance: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const ids = balances.map((b) => String(b.userId))
    const users = await User.find({ _id: { $in: ids } }).select("username email").lean()
    const userMap = new Map(users.map((u) => [String(u._id), u]))

    const ledger = await CollexCoinTransaction.find({}).sort({ createdAt: -1 }).limit(30).lean()
    const ledgerIds = [...new Set(ledger.map((l) => String(l.userId)))]
    const ledgerUsers = await User.find({ _id: { $in: ledgerIds } }).select("username").lean()
    const ledgerUserMap = new Map(ledgerUsers.map((u) => [String(u._id), u.username]))

    const circulating = await CollexCoinBalance.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }])

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      circulating: circulating[0]?.total || 0,
      balances: balances.map((b) => ({
        userId: String(b.userId),
        username: userMap.get(String(b.userId))?.username || "—",
        email: userMap.get(String(b.userId))?.email || "",
        balance: b.balance,
        claimedSignupPlans: b.claimedSignupPlans || [],
      })),
      ledger: ledger.map((l) => ({
        id: String(l._id),
        username: ledgerUserMap.get(String(l.userId)) || "—",
        amount: l.amount,
        type: l.type,
        description: l.description,
        balanceAfter: l.balanceAfter,
        createdAt: l.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/coins error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
