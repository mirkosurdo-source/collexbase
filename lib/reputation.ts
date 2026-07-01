import { connectDB } from "@/lib/db"
import Review from "@/lib/models/Review"
import Escrow from "@/lib/models/Escrow"
import Trade from "@/lib/models/Trade"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import Reputation from "@/lib/models/Reputation"

export interface ReputationResult {
  score: number
  tier: string
  avgRating: number
  reviewCount: number
  salesCount: number
  tradesCount: number
  communityPoints: number
  history: { label: string; value: number }[]
}

/** Maps a 0-100 score to a reputation tier label + badge styling key. */
export function reputationTier(score: number): string {
  if (score >= 90) return "Leggenda"
  if (score >= 75) return "Veterano"
  if (score >= 50) return "Esperto"
  if (score >= 20) return "Affidabile"
  return "Nuovo"
}

/**
 * Recomputes a user's reputation from all available signals and caches the
 * result. Safe to call after any reputation-affecting action.
 *
 * Score (0-100) is a weighted blend of:
 *  - average review rating (up to 45)
 *  - completed sales (up to 20)
 *  - completed trades (up to 15)
 *  - community activity (up to 20)
 */
export async function computeReputation(userId: string): Promise<ReputationResult> {
  await connectDB()

  const reviews = (await Review.find({ targetUserId: userId }).select("rating").lean()) as Array<{ rating: number }>
  const reviewCount = reviews.length
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0

  const salesCount = await Escrow.countDocuments({ sellerId: userId, status: "released" })
  const tradesCount = await Trade.countDocuments({
    status: "accepted",
    $or: [{ fromUserId: String(userId) }, { toUserId: String(userId) }],
  })

  const postCount = await Post.countDocuments({ authorId: userId })
  const commentCount = await Comment.countDocuments({ authorId: userId })
  const likeAgg = await Post.aggregate([
    { $match: { authorId: typeof userId === "string" ? toObjectId(userId) : userId } },
    { $group: { _id: null, total: { $sum: "$likeCount" } } },
  ])
  const likesReceived = likeAgg[0]?.total ?? 0
  const communityPoints = postCount * 2 + commentCount + likesReceived

  // Confidence factor: ratings matter more once there are several reviews.
  const confidence = Math.min(1, reviewCount / 5)
  const ratingScore = (avgRating / 5) * 45 * confidence
  const salesScore = Math.min(20, salesCount * 2)
  const tradesScore = Math.min(15, tradesCount * 1.5)
  const communityScore = Math.min(20, communityPoints * 0.5)

  const score = Math.round(ratingScore + salesScore + tradesScore + communityScore)
  const tier = reputationTier(score)

  // Persist + maintain a monthly history snapshot (max 12 points).
  const label = new Date().toLocaleDateString("it-IT", { month: "short", year: "2-digit" })
  const existing = await Reputation.findOne({ userId })
  let history: { label: string; value: number }[] = existing?.history?.map((h: { label: string; value: number }) => ({
    label: h.label,
    value: h.value,
  })) ?? []

  if (history.length && history[history.length - 1].label === label) {
    history[history.length - 1].value = score
  } else {
    history.push({ label, value: score })
  }
  if (history.length > 12) history = history.slice(history.length - 12)

  await Reputation.findOneAndUpdate(
    { userId },
    {
      userId,
      score,
      tier,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount,
      salesCount,
      tradesCount,
      communityPoints,
      history,
      computedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return {
    score,
    tier,
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount,
    salesCount,
    tradesCount,
    communityPoints,
    history,
  }
}

// Lazily import mongoose Types to avoid a hard dependency at module top-level.
function toObjectId(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Types } = require("mongoose")
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}
