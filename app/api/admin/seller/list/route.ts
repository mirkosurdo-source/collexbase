import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import SellerProfile from "@/lib/models/SellerProfile"
import { serializeProfile } from "@/lib/seller"

// GET /api/admin/seller/list?status=active|inactive — admin only.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  await connectDB()
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const query: Record<string, unknown> = {}
  if (status === "active") query.active = true
  if (status === "inactive") query.active = false

  const profiles = await SellerProfile.find(query).sort({ updatedAt: -1 }).limit(500)
  const sellers = profiles.map((p) => serializeProfile(p))

  const totals = sellers.reduce(
    (acc, s) => {
      acc.totalSales += s.totalSales
      acc.totalCommission += s.totalCommission
      acc.totalOrders += s.totalOrders
      return acc
    },
    { totalSales: 0, totalCommission: 0, totalOrders: 0 },
  )

  return NextResponse.json({ success: true, sellers, totals })
}
