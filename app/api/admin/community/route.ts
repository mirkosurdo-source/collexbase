import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import Review from "@/lib/models/Review"
import Reputation from "@/lib/models/Reputation"

export const dynamic = "force-dynamic"

/**
 * Community moderation views, selected by `?view=`:
 *  - posts        : feed + blog entries
 *  - comments     : recent comments
 *  - reviews      : reputation reviews
 *  - reputation   : cached reputation leaderboard / badges
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "posts"
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20
    const skip = (page - 1) * limit

    if (view === "comments") {
      const total = await Comment.countDocuments({})
      const comments = await Comment.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
      return NextResponse.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        comments: comments.map((c) => ({
          id: String(c._id),
          author: c.authorUsername || "—",
          body: c.body,
          likeCount: c.likeCount || 0,
          postId: String(c.postId),
          createdAt: c.createdAt,
        })),
      })
    }

    if (view === "reviews") {
      const total = await Review.countDocuments({})
      const reviews = await Review.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
      return NextResponse.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        reviews: reviews.map((r) => ({
          id: String(r._id),
          author: r.authorUsername || "—",
          target: r.targetUsername || "—",
          type: r.type,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
      })
    }

    if (view === "reputation") {
      const total = await Reputation.countDocuments({})
      const reps = await Reputation.find({}).sort({ score: -1 }).skip(skip).limit(limit).lean()
      const User = (await import("@/lib/models/User")).default
      const ids = reps.map((r) => String(r.userId))
      const users = await User.find({ _id: { $in: ids } }).select("username").lean()
      const map = new Map(users.map((u) => [String(u._id), u.username]))
      return NextResponse.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        reputation: reps.map((r) => ({
          userId: String(r.userId),
          username: map.get(String(r.userId)) || "—",
          score: r.score,
          tier: r.tier,
          avgRating: r.avgRating,
          reviewCount: r.reviewCount,
          salesCount: r.salesCount,
          tradesCount: r.tradesCount,
          communityPoints: r.communityPoints,
        })),
      })
    }

    // Default: posts.
    const total = await Post.countDocuments({})
    const posts = await Post.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      posts: posts.map((p) => ({
        id: String(p._id),
        author: p.authorUsername || "—",
        kind: p.kind,
        title: p.title || "",
        body: p.body || "",
        category: p.category || "",
        likeCount: p.likeCount || 0,
        commentCount: p.commentCount || 0,
        createdAt: p.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/community error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
