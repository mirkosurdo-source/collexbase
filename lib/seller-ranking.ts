/**
 * Blocco 47 — Marketplace 2.0 seller ranking.
 *
 * Computes a 0-100 seller score from real signals (reviews, reputation, Pro
 * seller aggregates, recent sales, disputes) and maps it to a tier badge.
 * Read-only over existing collections; result cached in SellerRanking.
 */
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import Review from "@/lib/models/Review"
import Escrow from "@/lib/models/Escrow"
import SellerProfile from "@/lib/models/SellerProfile"
import SellerOrder from "@/lib/models/SellerOrder"
import SellerRanking from "@/lib/models/SellerRanking"

export interface SellerRankingResult {
  sellerId: string
  score: number
  tier: string
  ordersCompleted: number
  rating: number
  ratingCount: number
  disputes: number
  last30DaysSales: number
  commissionPaid: number
}

function toObjectId(id: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

/** Maps a 0-100 score to a seller tier badge label ("" = unranked). */
export function rankingTier(score: number, ordersCompleted: number): string {
  // Require a minimum of completed orders so a single 5-star review can't mint a badge.
  if (ordersCompleted < 1) return ""
  if (score >= 90) return "Elite Seller"
  if (score >= 75) return "Power Seller"
  if (score >= 55) return "Top Seller"
  if (score >= 35) return "Trusted Seller"
  return ""
}

/**
 * Recomputes and caches a seller's ranking. Safe to call after any sale,
 * review or dispute. Returns zeros for users who have never sold.
 */
export async function computeSellerRanking(sellerId: string): Promise<SellerRankingResult> {
  await connectDB()
  const oid = toObjectId(sellerId)

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [reviews, profile, releasedSales, last30, disputes, proOrders] = await Promise.all([
    Review.find({ targetUserId: oid, type: "seller" }).select("rating").lean() as Promise<Array<{ rating: number }>>,
    SellerProfile.findOne({ userId: oid }).lean() as Promise<Record<string, unknown> | null>,
    Escrow.countDocuments({ sellerId: oid, status: "released" }),
    Escrow.countDocuments({ sellerId: oid, status: "released", releasedAt: { $gte: since30 } }),
    // No dedicated dispute state exists; refunds are the closest negative signal.
    Escrow.countDocuments({ sellerId: oid, status: "refunded" }),
    SellerOrder.countDocuments({ sellerId: oid, status: "completed" }),
  ])

  const reviewCount = reviews.length
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0

  // Prefer the maintained Pro-seller aggregates when present.
  const proRating = profile && typeof profile.rating === "number" ? (profile.rating as number) : 0
  const proRatingCount = profile && typeof profile.ratingCount === "number" ? (profile.ratingCount as number) : 0
  const rating = proRatingCount > 0 ? proRating : avgRating
  const ratingCount = proRatingCount > 0 ? proRatingCount : reviewCount

  const ordersCompleted = (profile?.totalOrders as number) || releasedSales + proOrders
  const commissionPaid = (profile?.totalCommission as number) || 0
  const last30DaysSales = last30 + (profile ? 0 : 0)

  // --- Scoring (0-100) ---------------------------------------------------
  // Rating up to 45 (confidence-weighted), orders up to 25, recent activity up
  // to 15, commission contribution up to 10, minus dispute penalty up to 25.
  const confidence = Math.min(1, ratingCount / 5)
  const ratingScore = (rating / 5) * 45 * confidence
  const ordersScore = Math.min(25, ordersCompleted * 1.5)
  const recentScore = Math.min(15, last30DaysSales * 3)
  const commissionScore = Math.min(10, commissionPaid * 0.5)
  const disputePenalty = Math.min(25, disputes * 8)

  const raw = ratingScore + ordersScore + recentScore + commissionScore - disputePenalty
  const score = Math.max(0, Math.min(100, Math.round(raw)))
  const tier = rankingTier(score, ordersCompleted)

  await SellerRanking.findOneAndUpdate(
    { sellerId: oid },
    {
      sellerId: oid,
      score,
      tier,
      ordersCompleted,
      rating: Math.round(rating * 10) / 10,
      ratingCount,
      disputes,
      last30DaysSales,
      commissionPaid: Math.round(commissionPaid * 100) / 100,
      computedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return {
    sellerId: String(sellerId),
    score,
    tier,
    ordersCompleted,
    rating: Math.round(rating * 10) / 10,
    ratingCount,
    disputes,
    last30DaysSales,
    commissionPaid: Math.round(commissionPaid * 100) / 100,
  }
}

/** Fast cached read; computes lazily if missing or stale (>6h). */
export async function getSellerRanking(sellerId: string): Promise<SellerRankingResult> {
  await connectDB()
  const cached = (await SellerRanking.findOne({ sellerId: toObjectId(sellerId) }).lean()) as Record<
    string,
    unknown
  > | null
  const stale = !cached || Date.now() - new Date(cached.computedAt as Date).getTime() > 6 * 60 * 60 * 1000
  if (stale) return computeSellerRanking(sellerId)
  return {
    sellerId: String(sellerId),
    score: (cached.score as number) || 0,
    tier: (cached.tier as string) || "",
    ordersCompleted: (cached.ordersCompleted as number) || 0,
    rating: (cached.rating as number) || 0,
    ratingCount: (cached.ratingCount as number) || 0,
    disputes: (cached.disputes as number) || 0,
    last30DaysSales: (cached.last30DaysSales as number) || 0,
    commissionPaid: (cached.commissionPaid as number) || 0,
  }
}
