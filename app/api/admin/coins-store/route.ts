import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import CoinStorePurchase from "@/lib/models/CoinStorePurchase"
import { STORE_PACKAGES } from "@/lib/coins-store"

export const dynamic = "force-dynamic"

interface PurchaseFilter {
  status: "completed"
  packageId?: string
  userId?: string
}

/**
 * Admin coin-store analytics: completed-purchase history (filterable by user /
 * package), revenue + coins-sold totals, per-package breakdown and a 14-day
 * sales trend.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20
    const usernameQ = (url.searchParams.get("username") || "").trim()
    const packageId = (url.searchParams.get("packageId") || "").trim()

    const filter: PurchaseFilter = { status: "completed" }
    if (packageId) filter.packageId = packageId

    // Resolve a username filter to a userId.
    if (usernameQ) {
      const u = await User.findOne({ username: new RegExp(`^${usernameQ}$`, "i") }).select("_id").lean()
      filter.userId = u ? String((u as { _id: unknown })._id) : "__none__"
    }

    const total = await CoinStorePurchase.countDocuments(filter)
    const purchases = await CoinStorePurchase.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const userIds = [...new Set(purchases.map((p) => String(p.userId)))]
    const users = await User.find({ _id: { $in: userIds } }).select("username").lean()
    const userMap = new Map(users.map((u) => [String(u._id), u.username]))

    // Global totals (all completed purchases — independent of filters).
    const totalsAgg = await CoinStorePurchase.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$finalPrice" },
          coinsSold: { $sum: "$coins" },
          count: { $sum: 1 },
        },
      },
    ])
    const totals = totalsAgg[0] || { revenue: 0, coinsSold: 0, count: 0 }

    // Per-package breakdown.
    const byPackageAgg = await CoinStorePurchase.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$packageId",
          coins: { $sum: "$coins" },
          revenue: { $sum: "$finalPrice" },
          count: { $sum: 1 },
        },
      },
    ])
    const byPackageMap = new Map(byPackageAgg.map((b) => [b._id, b]))
    const byPackage = STORE_PACKAGES.map((def) => {
      const row = byPackageMap.get(def.id)
      return {
        packageId: def.id,
        coins: def.coins,
        count: row?.count || 0,
        revenue: row?.revenue || 0,
        coinsSold: row?.coins || 0,
      }
    })

    // 14-day sales trend (revenue per day).
    const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
    since.setHours(0, 0, 0, 0)
    const trendAgg = await CoinStorePurchase.aggregate([
      { $match: { status: "completed", createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$finalPrice" },
        },
      },
    ])
    const trendMap = new Map(trendAgg.map((t) => [t._id, t.revenue]))
    const trend: { label: string; value: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      trend.push({
        label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        value: Math.round((trendMap.get(key) || 0) * 100) / 100,
      })
    }

    return NextResponse.json({
      success: true,
      page,
      pages: Math.ceil(total / limit),
      total,
      totals: {
        revenue: Math.round(totals.revenue * 100) / 100,
        coinsSold: totals.coinsSold,
        count: totals.count,
      },
      byPackage,
      trend,
      packages: STORE_PACKAGES.map((p) => ({ id: p.id, coins: p.coins })),
      purchases: purchases.map((p) => ({
        id: String(p._id),
        username: userMap.get(String(p.userId)) || "—",
        packageId: p.packageId,
        coins: p.coins,
        tier: p.tier,
        finalPrice: p.finalPrice,
        savings: p.savings,
        totalDiscountPct: p.totalDiscountPct,
        createdAt: p.createdAt,
      })),
    })
  } catch (error) {
    console.error("[v0] admin coins-store error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
