/**
 * Blocco 28 — review domain helpers.
 *
 * Pure read helpers over the existing Review model (type: seller | buyer | trade).
 * No existing review/reputation logic is modified; this module only summarizes
 * and derives trust signals used by the profile, AI advisor and admin panel.
 */

import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import Review from "@/lib/models/Review"
import User from "@/lib/models/User"

export type ReviewType = "seller" | "buyer" | "trade"

export interface CategoryBreakdown {
  count: number
  avg: number
}

export interface TrustBadge {
  id: string
  label: string
  earned: boolean
}

export interface ReviewSummary {
  total: number
  avg: number
  /** Count per star (1..5). */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  breakdown: Record<ReviewType, CategoryBreakdown>
  trustBadges: TrustBadge[]
}

function toObjectId(id: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Derives the rating-based "trust" badges (Blocco 28 §6). */
export function deriveTrustBadges(breakdown: Record<ReviewType, CategoryBreakdown>): TrustBadge[] {
  return [
    {
      id: "trust_seller",
      label: "Venditore affidabile",
      earned: breakdown.seller.count >= 20 && breakdown.seller.avg >= 4.5,
    },
    {
      id: "trust_trade",
      label: "Scambiatore affidabile",
      earned: breakdown.trade.count >= 10 && breakdown.trade.avg >= 4.5,
    },
    {
      id: "trust_buyer",
      label: "Acquirente affidabile",
      earned: breakdown.buyer.count >= 10 && breakdown.buyer.avg >= 4.5,
    },
  ]
}

/** Full review summary for a target user: average, distribution, per-type breakdown, trust badges. */
export async function getReviewSummary(userId: string): Promise<ReviewSummary> {
  await connectDB()
  const oid = toObjectId(userId)

  const reviews = (await Review.find({ targetUserId: oid }).select("rating type").lean()) as Array<{
    rating: number
    type: ReviewType
  }>

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const sums: Record<ReviewType, { total: number; count: number }> = {
    seller: { total: 0, count: 0 },
    buyer: { total: 0, count: 0 },
    trade: { total: 0, count: 0 },
  }

  let total = 0
  let ratingSum = 0
  for (const r of reviews) {
    const rating = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[rating] += 1
    total += 1
    ratingSum += r.rating
    const type = (["seller", "buyer", "trade"] as const).includes(r.type) ? r.type : "seller"
    sums[type].total += r.rating
    sums[type].count += 1
  }

  const breakdown: Record<ReviewType, CategoryBreakdown> = {
    seller: { count: sums.seller.count, avg: sums.seller.count ? round1(sums.seller.total / sums.seller.count) : 0 },
    buyer: { count: sums.buyer.count, avg: sums.buyer.count ? round1(sums.buyer.total / sums.buyer.count) : 0 },
    trade: { count: sums.trade.count, avg: sums.trade.count ? round1(sums.trade.total / sums.trade.count) : 0 },
  }

  return {
    total,
    avg: total ? round1(ratingSum / total) : 0,
    distribution,
    breakdown,
    trustBadges: deriveTrustBadges(breakdown),
  }
}

/** Number of reviews authored by a user — feeds the "Recensore" badge group. */
export async function countReviewsWritten(userId: string): Promise<number> {
  await connectDB()
  return Review.countDocuments({ authorId: toObjectId(userId) })
}

export interface ReliabilityEntry {
  userId: string
  username: string
  name: string
  avatar: string
  avg: number
  count: number
}

/**
 * Reliability lists for the AI advisor (Blocco 28 §8): trusted sellers (high
 * average with enough reviews) and risky sellers (low average). Aggregated over
 * seller-type reviews only.
 */
export async function getSellerReliability(limit = 6): Promise<{
  trusted: ReliabilityEntry[]
  risky: ReliabilityEntry[]
}> {
  await connectDB()

  const agg = (await Review.aggregate([
    { $match: { type: "seller" } },
    { $group: { _id: "$targetUserId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 3 } } },
  ])) as Array<{ _id: Types.ObjectId; avg: number; count: number }>

  if (agg.length === 0) return { trusted: [], risky: [] }

  const users = await User.find({ _id: { $in: agg.map((a) => a._id) } })
    .select("name username avatar")
    .lean()
  const map = new Map(users.map((u) => [String(u._id), u]))

  const decorate = (a: { _id: Types.ObjectId; avg: number; count: number }): ReliabilityEntry => {
    const u = map.get(String(a._id))
    return {
      userId: String(a._id),
      username: u?.username ?? "",
      name: u?.name ?? "Utente",
      avatar: u?.avatar ?? "",
      avg: round1(a.avg),
      count: a.count,
    }
  }

  const trusted = agg
    .filter((a) => a.avg >= 4.5)
    .sort((x, y) => y.avg - x.avg || y.count - x.count)
    .slice(0, limit)
    .map(decorate)

  const risky = agg
    .filter((a) => a.avg < 3)
    .sort((x, y) => x.avg - y.avg || y.count - x.count)
    .slice(0, limit)
    .map(decorate)

  return { trusted, risky }
}
