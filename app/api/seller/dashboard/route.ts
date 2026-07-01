import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import SellerOrder from "@/lib/models/SellerOrder"
import SellerInventoryItem from "@/lib/models/SellerInventoryItem"
import {
  getActiveSellerProfile,
  refreshConnectStatus,
  serializeProfile,
  serializeOrder,
} from "@/lib/seller"

// GET /api/seller/dashboard — stats, 30-day charts, recent orders, payouts.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const active = await getActiveSellerProfile(userId)
  if (!active)
    return NextResponse.json({ success: false, message: "Profilo venditore non attivo." }, { status: 403 })

  await connectDB()
  const profile = (await refreshConnectStatus(userId)) || active
  const sellerOid = new Types.ObjectId(userId)

  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const [recentOrders, dailyAgg, inventoryCount, publishedCount, pendingAgg, availableAgg] = await Promise.all([
    SellerOrder.find({ sellerId: sellerOid }).sort({ createdAt: -1 }).limit(10),
    SellerOrder.aggregate([
      { $match: { sellerId: sellerOid, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sales: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
    ]),
    SellerInventoryItem.countDocuments({ sellerId: sellerOid }),
    SellerInventoryItem.countDocuments({ sellerId: sellerOid, published: true }),
    SellerOrder.aggregate([
      { $match: { sellerId: sellerOid, status: { $in: ["pending", "paid", "shipped"] } } },
      { $group: { _id: null, total: { $sum: "$payoutAmount" } } },
    ]),
    SellerOrder.aggregate([
      { $match: { sellerId: sellerOid, status: "completed", payoutSettled: true } },
      { $group: { _id: null, total: { $sum: "$payoutAmount" } } },
    ]),
  ])

  // Build a continuous 30-day series.
  const byDay = new Map<string, { sales: number; orders: number }>()
  for (const d of dailyAgg) byDay.set(d._id, { sales: d.sales, orders: d.orders })
  const salesSeries: { label: string; value: number }[] = []
  const ordersSeries: { label: string; value: number }[] = []
  for (let i = 0; i < 30; i++) {
    const day = new Date(since)
    day.setDate(since.getDate() + i)
    const key = day.toISOString().slice(0, 10)
    const label = key.slice(5) // MM-DD
    const entry = byDay.get(key) || { sales: 0, orders: 0 }
    salesSeries.push({ label, value: Math.round(entry.sales * 100) / 100 })
    ordersSeries.push({ label, value: entry.orders })
  }

  return NextResponse.json({
    success: true,
    profile: serializeProfile(profile),
    charts: { sales: salesSeries, orders: ordersSeries },
    inventory: { total: inventoryCount, published: publishedCount },
    payouts: {
      available: Math.round((availableAgg[0]?.total || 0) * 100) / 100,
      pending: Math.round((pendingAgg[0]?.total || 0) * 100) / 100,
    },
    recentOrders: recentOrders.map((o) => serializeOrder(o)),
  })
}
