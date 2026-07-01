import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import UserSubscriptionState from "@/lib/models/UserSubscriptionState"
import CollexCoinBalance from "@/lib/models/CollexCoinBalance"
import PaymentWallet from "@/lib/models/PaymentWallet"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import PaymentTransaction from "@/lib/models/PaymentTransaction"
import Trade from "@/lib/models/Trade"
import Auction from "@/lib/models/Auction"
import Listing from "@/lib/models/Listing"

export const dynamic = "force-dynamic"

/** Sums a numeric field across a collection via aggregation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sumField(Model: any, field: string, match: Record<string, unknown> = {}) {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }])
  return (rows[0]?.total as number) || 0
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()

    const now = new Date()
    const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const [
      totalUsers,
      blockedUsers,
      planRows,
      coinTotal,
      walletAvailable,
      walletPending,
      walletBlocked,
      escrowHeld,
      escrowDisputed,
      activeTrades,
      activeAuctions,
      activeListings,
      soldListings,
      openDisputes,
      txToday,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ blocked: true }),
      UserSubscriptionState.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
      sumField(CollexCoinBalance, "balance"),
      sumField(PaymentWallet, "available"),
      sumField(PaymentWallet, "pending"),
      sumField(PaymentWallet, "blocked"),
      sumField(PaymentEscrow, "sellerNet", { status: "held" }),
      sumField(PaymentEscrow, "sellerNet", { status: "disputed" }),
      Trade.countDocuments({ status: "pending" }),
      Auction.countDocuments({ status: "active" }),
      Listing.countDocuments({ status: "active" }),
      Listing.countDocuments({ status: "sold" }),
      PaymentEscrow.countDocuments({ status: "disputed" }),
      PaymentTransaction.countDocuments({ createdAt: { $gte: startToday } }),
    ])

    // Subscriptions by tier (Base counts users without a state row too).
    const planMap: Record<string, number> = { Base: 0, Gold: 0, Premium: 0 }
    let withState = 0
    for (const r of planRows as { _id: string; count: number }[]) {
      planMap[r._id] = (planMap[r._id] || 0) + r.count
      withState += r.count
    }
    // Users without a subscription state row are implicitly Base.
    planMap.Base += Math.max(0, totalUsers - withState)

    // Transaction volume (EUR) over the last 14 days for the line chart.
    const start14 = new Date(startToday)
    start14.setUTCDate(start14.getUTCDate() - 13)
    const dailyRows = await PaymentTransaction.aggregate([
      { $match: { createdAt: { $gte: start14 } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          volume: { $sum: { $abs: "$amount" } },
          count: { $sum: 1 },
        },
      },
    ])
    const dailyMap = new Map<string, { volume: number; count: number }>()
    for (const r of dailyRows as { _id: string; volume: number; count: number }[]) {
      dailyMap.set(r._id, { volume: r.volume, count: r.count })
    }
    const transactionsSeries: { label: string; volume: number; count: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(start14)
      d.setUTCDate(d.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      const entry = dailyMap.get(key) || { volume: 0, count: 0 }
      transactionsSeries.push({
        label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        volume: Math.round(entry.volume * 100) / 100,
        count: entry.count,
      })
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        blockedUsers,
        subscriptions: planMap,
        activeSubscriptions: planMap.Gold + planMap.Premium,
        collexCoinTotal: coinTotal,
        walletTotal: Math.round((walletAvailable + walletPending + walletBlocked) * 100) / 100,
        walletAvailable: Math.round(walletAvailable * 100) / 100,
        walletPending: Math.round(walletPending * 100) / 100,
        walletBlocked: Math.round(walletBlocked * 100) / 100,
        escrowTotal: Math.round((escrowHeld + escrowDisputed) * 100) / 100,
        transactionsToday: txToday,
        activeTrades,
        activeAuctions,
        activeListings,
        soldListings,
        openDisputes,
      },
      charts: {
        transactionsSeries,
        subscriptionsByTier: [
          { category: "Base", value: planMap.Base },
          { category: "Gold", value: planMap.Gold },
          { category: "Premium", value: planMap.Premium },
        ],
      },
    })
  } catch (err) {
    console.error("[v0] admin/dashboard error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
