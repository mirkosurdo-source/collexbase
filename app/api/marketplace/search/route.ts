import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import SellerProfile from "@/lib/models/SellerProfile"
import SellerRanking from "@/lib/models/SellerRanking"
import { getAuthUserId } from "@/lib/auth/request"
import { getBoostsForTargets } from "@/lib/boost"

const PAGE_SIZE = 12
const CANDIDATE_CAP = 300

/**
 * Blocco 47 — advanced marketplace search.
 *
 * Extends the base listing filter with seller-type (Pro/normal/verified),
 * minimum seller ranking and richer sorts (best seller / trending), decorating
 * each result with its seller's cached ranking. Purely additive: the original
 * /api/market/list endpoint is untouched.
 */
export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)

    const query = (searchParams.get("query") || "").trim()
    const category = searchParams.get("category") || ""
    const mode = searchParams.get("mode") || ""
    const priceMin = searchParams.get("priceMin")
    const priceMax = searchParams.get("priceMax")
    const conditions = (searchParams.get("condition") || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
    const sellerType = searchParams.get("sellerType") || "" // pro | normal
    const minRanking = Number(searchParams.get("minRanking")) || 0
    const verifiedOnly = searchParams.get("verified") === "1"
    const freeShipping = searchParams.get("freeShipping") === "1"
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
    if (conditions.length) filter.condition = { $in: conditions }
    if (mode === "trade") filter.acceptsTrade = true
    if (mode === "item_cash") filter.acceptsItemPlusCash = true
    if (mode === "item_coins") filter.acceptsItemPlusCoins = true
    if (priceMin || priceMax) {
      const pf: Record<string, number> = {}
      if (priceMin) pf.$gte = Number(priceMin)
      if (priceMax) pf.$lte = Number(priceMax)
      filter.price = pf
    }

    // Candidate set (capped). Seller-type/ranking filtering happens after join.
    const candidates = (await Listing.find(filter)
      .sort({ createdAt: -1 })
      .limit(CANDIDATE_CAP)
      .lean()) as Array<Record<string, unknown>>

    const sellerIds = [...new Set(candidates.map((l) => String(l.sellerId)))]
    const [profiles, rankings] = await Promise.all([
      SellerProfile.find({ userId: { $in: sellerIds }, active: true }).select("userId").lean() as Promise<
        Array<{ userId: unknown }>
      >,
      SellerRanking.find({ sellerId: { $in: sellerIds } }).select("sellerId score tier").lean() as Promise<
        Array<{ sellerId: unknown; score: number; tier: string }>
      >,
    ])
    const proSet = new Set(profiles.map((p) => String(p.userId)))
    const rankMap = new Map(rankings.map((r) => [String(r.sellerId), { score: r.score || 0, tier: r.tier || "" }]))

    // Active boosts for ordering.
    const boostMap = await getBoostsForTargets(
      "marketplace",
      candidates.map((l) => String(l._id)),
    )

    let decorated = candidates.map((l) => {
      const sid = String(l.sellerId)
      const rank = rankMap.get(sid) || { score: 0, tier: "" }
      const boost = boostMap[String(l._id)]
      return {
        ...l,
        _id: String(l._id),
        sellerId: sid,
        isPro: proSet.has(sid),
        sellerScore: rank.score,
        sellerTier: rank.tier,
        boostTier: boost?.tier,
        boostRank: boost?.rankWeight ?? 0,
      }
    })

    // Post-join filters.
    if (sellerType === "pro" || verifiedOnly) decorated = decorated.filter((l) => l.isPro)
    if (sellerType === "normal") decorated = decorated.filter((l) => !l.isPro)
    if (minRanking > 0) decorated = decorated.filter((l) => l.sellerScore >= minRanking)
    if (freeShipping) decorated = decorated.filter((l) => l.isPro) // Pro sellers offer free shipping.

    // Sorting (boosted listings always float first).
    const num = (v: unknown): number => (typeof v === "number" ? v : 0)
    const time = (v: unknown): number => (v ? new Date(v as string).getTime() : 0)
    type Row = Record<string, unknown>
    const sorters: Record<string, (a: Row, b: Row) => number> = {
      recent: (a, b) => time(b.createdAt) - time(a.createdAt),
      price_asc: (a, b) => num(a.price) - num(b.price),
      price_desc: (a, b) => num(b.price) - num(a.price),
      popular: (a, b) => num(b.savedCount) - num(a.savedCount),
      trending: (a, b) => num(b.viewsCount) - num(a.viewsCount),
      best_seller: (a, b) => num(b.sellerScore) - num(a.sellerScore),
    }
    const sorter = sorters[sort] || sorters.recent
    decorated.sort((a, b) => num(b.boostRank) - num(a.boostRank) || sorter(a, b))

    const total = decorated.length
    const start = (page - 1) * PAGE_SIZE
    const items = decorated.slice(start, start + PAGE_SIZE)

    return NextResponse.json({
      success: true,
      listings: items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      // Surfaced so the client can keep its auth header optional.
      authed: Boolean(getAuthUserId(req)),
    })
  } catch (error) {
    console.error("[v0] marketplace/search error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
