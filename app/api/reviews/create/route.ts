import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Review from "@/lib/models/Review"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"
import { computeReputation } from "@/lib/reputation"
import Reputation from "@/lib/models/Reputation"
import { getReviewSummary } from "@/lib/reviews"
import { notifyNewReview, notifyAvgIncreased, notifyTrustEarned } from "@/lib/review-notifications"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const { targetUsername, type, rating, comment, refId } = body

    const numericRating = Number(rating)
    if (!targetUsername || !numericRating || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: "Valutazione (1-5) e utente sono obbligatori." }, { status: 400 })
    }
    if (!["seller", "buyer", "trade"].includes(type)) {
      return NextResponse.json({ error: "Tipo di recensione non valido." }, { status: 400 })
    }

    await connectDB()

    const target = await User.findOne({ username: targetUsername }).select("_id username")
    if (!target) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 })
    if (String(target._id) === userId) {
      return NextResponse.json({ error: "Non puoi recensire te stesso." }, { status: 400 })
    }

    const author = await getAuthor(userId)

    // Snapshot the previous average so we can detect an increase afterwards.
    const prevRep = await Reputation.findOne({ userId: target._id }).select("avgRating").lean<{ avgRating?: number } | null>()
    const previousAvg = prevRep?.avgRating ?? 0

    const review = await Review.create({
      targetUserId: target._id,
      targetUsername: target.username,
      authorId: userId,
      authorUsername: author?.username || "",
      authorAvatar: author?.avatar || "",
      type,
      rating: numericRating,
      comment: (comment || "").trim().slice(0, 1000),
      refId: refId || "",
    })

    // Recompute the target's reputation immediately.
    const reputation = await computeReputation(String(target._id))

    // CollexSpark notifications (fire-and-forget — never block the response).
    const targetId = String(target._id)
    void notifyNewReview({
      targetUserId: targetId,
      targetUsername: target.username,
      authorUsername: author?.username || "",
      rating: numericRating,
    })
    if (reputation.avgRating > previousAvg && reputation.reviewCount > 1) {
      void notifyAvgIncreased({ targetUserId: targetId, targetUsername: target.username, newAvg: reputation.avgRating })
    }

    // Trust-badge thresholds (avg >= 4.5 with enough reviews per category).
    // Only notify at the exact crossing moment to avoid repeat notifications.
    try {
      const summary = await getReviewSummary(targetId)
      const THRESHOLD: Record<string, number> = { seller: 20, trade: 10, buyer: 10 }
      const cat = summary.breakdown[type as "seller" | "buyer" | "trade"]
      const badgeId = `trust_${type}`
      const tb = summary.trustBadges.find((b) => b.id === badgeId)
      if (tb?.earned && cat && cat.count === THRESHOLD[type]) {
        void notifyTrustEarned({ targetUserId: targetId, targetUsername: target.username, label: tb.label })
      }
    } catch {
      // non-critical
    }

    return NextResponse.json({ success: true, review, reputation })
  } catch (err) {
    console.error("[v0] review create error:", err)
    return NextResponse.json({ error: "Errore durante la creazione della recensione." }, { status: 500 })
  }
}
