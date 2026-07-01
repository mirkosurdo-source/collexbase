import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import { PLANS, type PlanId } from "@/lib/subscription"

export const dynamic = "force-dynamic"

/** Admin marketplace listing browser with status filter + fee preview. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const status = url.searchParams.get("status") || ""
    const q = (url.searchParams.get("q") || "").trim()
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20

    const filter: Record<string, unknown> = {}
    if (["active", "pending", "sold", "cancelled"].includes(status)) filter.status = status
    if (q) filter.itemName = { $regex: q, $options: "i" }

    const [total, listings, counts] = await Promise.all([
      Listing.countDocuments(filter),
      Listing.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Listing.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ])

    const countMap: Record<string, number> = {}
    for (const c of counts as { _id: string; count: number }[]) countMap[c._id] = c.count

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: countMap,
      listings: listings.map((l) => {
        const badge = (l.sellerBadge || "Base") as PlanId
        const plan = PLANS[badge] || PLANS.Base
        const price = l.price || 0
        return {
          id: String(l._id),
          itemName: l.itemName,
          seller: l.sellerUsername || "—",
          sellerBadge: badge,
          category: l.category || "",
          price,
          buyerFee: Math.round(price * plan.saleBuyerFee * 100) / 100,
          sellerFee: Math.round(price * plan.saleSellerFee * 100) / 100,
          status: l.status,
          viewsCount: l.viewsCount || 0,
          savedCount: l.savedCount || 0,
          createdAt: l.createdAt,
        }
      }),
    })
  } catch (err) {
    console.error("[v0] admin/marketplace error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
