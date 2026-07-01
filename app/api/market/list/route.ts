import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import SavedListing from "@/lib/models/SavedListing"
import { getAuthUserId } from "@/lib/auth/request"
import { getBoostsForTargets } from "@/lib/boost"

const PAGE_SIZE = 12

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)

    const query = (searchParams.get("query") || "").trim()
    const category = searchParams.get("category") || ""
    const mode = searchParams.get("mode") || "" // fixed | trade | item_cash | item_coins
    const priceMin = searchParams.get("priceMin")
    const priceMax = searchParams.get("priceMax")
    const sellerId = searchParams.get("sellerId") || ""
    const sort = searchParams.get("sort") || "recent"
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = { status: "active" }
    if (query) {
      filter.$or = [
        { itemName: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ]
    }
    if (category) filter.category = category
    if (sellerId) filter.sellerId = sellerId
    if (mode === "trade") filter.acceptsTrade = true
    if (mode === "item_cash") filter.acceptsItemPlusCash = true
    if (mode === "item_coins") filter.acceptsItemPlusCoins = true

    if (priceMin || priceMax) {
      const priceFilter: Record<string, number> = {}
      if (priceMin) priceFilter.$gte = Number(priceMin)
      if (priceMax) priceFilter.$lte = Number(priceMax)
      filter.price = priceFilter
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      recent: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      popular: { savedCount: -1 },
    }

    const total = await Listing.countDocuments(filter)
    const listings = await Listing.find(filter)
      .sort(sortMap[sort] || sortMap.recent)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean()

    // Mark which listings the current user has saved.
    const userId = getAuthUserId(req)
    let savedIds: Set<string> = new Set()
    if (userId) {
      const saved = await SavedListing.find({ userId }).select("listingId").lean()
      savedIds = new Set(saved.map((s: Record<string, unknown>) => String(s.listingId)))
    }

    // Decorate with active boosts and float boosted listings to the top of the page.
    const boostMap = await getBoostsForTargets(
      "marketplace",
      listings.map((l: Record<string, unknown>) => String(l._id)),
    )

    const items = listings
      .map((l: Record<string, unknown>) => {
        const boost = boostMap[String(l._id)]
        return {
          ...l,
          _id: String(l._id),
          saved: savedIds.has(String(l._id)),
          boostTier: boost?.tier,
          boostRank: boost?.rankWeight ?? 0,
        }
      })
      .sort((a, b) => (b.boostRank as number) - (a.boostRank as number))

    return NextResponse.json({
      success: true,
      listings: items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    })
  } catch (error) {
    console.error("[v0] market/list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
