import { connectDB } from "@/lib/db"
import AIAdvisor from "@/lib/models/AIAdvisor"

export type InsightBucket = "collection" | "marketplace" | "trades" | "auctions" | "wishlist" | "trends"

/**
 * Persists a computed insight bucket into the user's AIAdvisor cache so the
 * /advisor dashboard can render the last result instantly. Fire-and-forget:
 * a failure here must never break the API response.
 */
export async function persistInsights(userId: string, bucket: InsightBucket, cards: unknown[]): Promise<void> {
  try {
    await connectDB()
    await AIAdvisor.updateOne(
      { userId },
      { $set: { [`insights.${bucket}`]: cards, updatedAt: new Date() } },
      { upsert: true },
    )
  } catch (error) {
    console.error("[v0] persistInsights error:", error)
  }
}
