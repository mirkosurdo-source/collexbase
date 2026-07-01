import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Wallet from "@/lib/models/Wallet"
import { getAuthUserId } from "@/lib/auth/request"
import { computeReputation } from "@/lib/reputation"
import {
  gatherProfileStats,
  gatherRecentActivity,
  gatherCollectionHighlights,
  buildProfileAdvice,
} from "@/lib/profile-stats"
import { computeBadges, levelFromScore, BADGE_GROUP_META } from "@/lib/badges"
import { gatherChatActivity } from "@/lib/chat-stats"
import { syncProfileProgress } from "@/lib/profile-notifications"
import { getReviewSummary } from "@/lib/reviews"
import Review from "@/lib/models/Review"
import { gatherUserGroupStats, getUserGroups } from "@/lib/groups"
import { getShowcaseProfileSummary } from "@/lib/showcase"
import { getBoostProfileSummary } from "@/lib/boost"

export const dynamic = "force-dynamic"

/**
 * Blocco 27 — advanced profile endpoint. Aggregates reputation, badges, level,
 * activity, collection highlights, community + AI signals for /profile/[username].
 * Read-only over existing data. When the owner views their own profile we sync
 * progress so newly earned badges / level-ups generate notifications.
 */
export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await ctx.params
    const handle = (username || "").trim()
    if (!handle) {
      return NextResponse.json({ success: false, message: "Username mancante." }, { status: 400 })
    }

    await connectDB()
    const user = await User.findOne({ username: handle }).select("-password")
    if (!user) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    const userId = String(user._id)
    const viewerId = getAuthUserId(req)
    const isOwner = viewerId === userId

    const wallet = await Wallet.findOne({ userId: user._id })
    const visibility = wallet?.itemsVisibility ?? "public"
    const collectionVisible = visibility === "public" || isOwner

    // Aggregate everything in parallel.
    const [
      stats,
      reputation,
      activity,
      highlights,
      reviewSummary,
      recentReviews,
      chatActivity,
      groupStats,
      userGroups,
      showcaseSummary,
      boostSummary,
    ] = await Promise.all([
      gatherProfileStats(userId),
      computeReputation(userId),
      gatherRecentActivity(userId),
      collectionVisible
        ? gatherCollectionHighlights(userId)
        : Promise.resolve({ topValued: [], rarest: [], duplicates: 0 }),
      getReviewSummary(userId),
      Review.find({ targetUserId: user._id })
        .select("authorUsername authorAvatar type rating comment createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      gatherChatActivity(userId),
      gatherUserGroupStats(userId),
      getUserGroups(userId, 12),
      getShowcaseProfileSummary(userId, isOwner),
      isOwner ? getBoostProfileSummary(userId) : Promise.resolve(null),
    ])

    // Only expose public groups to non-owners (private memberships stay private).
    const visibleGroups = isOwner ? userGroups : userGroups.filter((g) => g.privacy === "public")

    const badges = computeBadges(stats)
    const earnedBadges = badges.filter((b) => b.earned)
    const level = levelFromScore(reputation.score)
    const advice = buildProfileAdvice(stats)

    // Owner-only: detect & notify newly earned badges / level-ups.
    if (isOwner) {
      void syncProfileProgress(userId, stats, reputation.score)
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: userId,
        name: user.name,
        username: user.username,
        bio: user.bio || "",
        avatar: user.avatar || "",
        badge: wallet?.badge ?? "Base",
        isOwner,
        createdAt: user.createdAt,
      },
      level,
      reputation: {
        score: reputation.score,
        tier: reputation.tier,
        avgRating: reputation.avgRating,
        reviewCount: reputation.reviewCount,
        history: reputation.history,
      },
      stats,
      badges,
      earnedBadgeCount: earnedBadges.length,
      totalBadgeCount: badges.length,
      groupMeta: BADGE_GROUP_META,
      activity,
      collection: {
        visible: collectionVisible,
        value: stats.collectionValue,
        ...highlights,
      },
      reviews: {
        summary: reviewSummary,
        recent: recentReviews,
      },
      chat: {
        conversations: chatActivity.conversations,
        messagesSent: chatActivity.messagesSent,
        // Most-contacted users are private — only exposed to the profile owner.
        mostContacted: isOwner ? chatActivity.mostContacted : [],
        advice: isOwner ? chatActivity.advice : [],
      },
      groups: {
        stats: groupStats,
        list: visibleGroups.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.category,
          coverImage: g.coverImage,
          memberCount: g.memberCount,
          role: g.role,
        })),
      },
      showcase: showcaseSummary && showcaseSummary.exists && showcaseSummary.visible ? showcaseSummary : null,
      boost: boostSummary
        ? {
            activeCount: boostSummary.active.length,
            active: boostSummary.active.slice(0, 6),
            totalCoinsSpent: boostSummary.totalCoinsSpent,
            counts: boostSummary.counts,
          }
        : null,
      advice,
    })
  } catch (error) {
    console.error("[v0] profile/[username] error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
