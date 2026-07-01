import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Follow from "@/lib/models/Follow"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"

/**
 * Blocco 25 — community discovery feed powering the sidebar:
 * recommended collectors, trending categories, popular posts, recent blogs,
 * and a contextual CollexSpark social tip.
 */
export async function GET(req: Request) {
  try {
    await connectDB()
    const userId = getAuthUserId(req)

    // Who the viewer already follows (so we don't recommend them again).
    let followingIds: string[] = []
    if (userId) {
      const follows = await Follow.find({ followerId: userId }).select("sellerId").lean()
      followingIds = follows.map((f: Record<string, unknown>) => String(f.sellerId))
    }
    const excludeIds = userId ? [...followingIds, userId] : []

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // --- Recommended collectors: most engaging public authors recently. ---
    const topAuthors = await Post.aggregate([
      { $match: { visibility: "public", createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$authorId",
          posts: { $sum: 1 },
          likes: { $sum: { $ifNull: ["$likeCount", 0] } },
        },
      },
      { $sort: { likes: -1, posts: -1 } },
      { $limit: 24 },
    ])

    const recommendIds = topAuthors
      .map((a) => String(a._id))
      .filter((id) => !excludeIds.includes(id))
      .slice(0, 5)

    const recUsers = recommendIds.length
      ? await User.find({ _id: { $in: recommendIds } }).select("username avatar name").lean()
      : []
    const recById = new Map(recUsers.map((u: Record<string, unknown>) => [String(u._id), u]))
    const statsById = new Map(topAuthors.map((a) => [String(a._id), a]))

    const recommendedUsers = recommendIds
      .map((id) => {
        const u = recById.get(id) as Record<string, unknown> | undefined
        if (!u) return null
        const s = statsById.get(id)
        return {
          userId: id,
          username: String(u.username || "collezionista"),
          avatar: String(u.avatar || ""),
          name: String(u.name || ""),
          posts: s?.posts || 0,
          likes: s?.likes || 0,
        }
      })
      .filter(Boolean)

    // --- Trending categories (last 30 days, public posts). ---
    const trendingAgg = await Post.aggregate([
      { $match: { visibility: "public", createdAt: { $gte: since }, category: { $nin: ["", null] } } },
      { $group: { _id: "$category", posts: { $sum: 1 }, likes: { $sum: { $ifNull: ["$likeCount", 0] } } } },
      { $sort: { posts: -1, likes: -1 } },
      { $limit: 6 },
    ])
    const trending = trendingAgg.map((t) => ({ category: String(t._id), posts: t.posts, likes: t.likes }))

    // --- Popular posts (top liked recent). ---
    const popularDocs = await Post.find({ kind: "post", visibility: "public" })
      .sort({ likeCount: -1, createdAt: -1 })
      .limit(5)
      .select("title body authorUsername likeCount commentCount category")
      .lean()
    const popularPosts = popularDocs.map((p: Record<string, unknown>) => {
      const body = String(p.body || "")
      return {
        id: String(p._id),
        title: String(p.title || "") || (body.length > 60 ? `${body.slice(0, 60)}...` : body) || "Post",
        authorUsername: String(p.authorUsername || ""),
        likeCount: Number(p.likeCount || 0),
        commentCount: Number(p.commentCount || 0),
        category: String(p.category || ""),
      }
    })

    // --- Recent blog entries. ---
    const blogDocs = await Post.find({ kind: "blog", visibility: "public" })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title authorUsername blogType category createdAt")
      .lean()
    const recentBlogs = blogDocs.map((p: Record<string, unknown>) => ({
      id: String(p._id),
      title: String(p.title || "Articolo"),
      authorUsername: String(p.authorUsername || ""),
      blogType: String(p.blogType || ""),
      category: String(p.category || ""),
      createdAt: p.createdAt,
    }))

    // --- CollexSpark social tip (contextual, not random noise). ---
    let sparkTip = "Condividi un pezzo della tua collezione: i post con foto ricevono molti più 'mi piace'!"
    if (userId && followingIds.length === 0) {
      sparkTip = "Inizia a seguire qualche collezionista: il tuo feed diventerà molto più interessante!"
    } else if (trending.length > 0) {
      sparkTip = `La categoria "${trending[0].category}" è caldissima in questo momento. Pubblica qualcosa a tema!`
    }

    return NextResponse.json({
      success: true,
      recommendedUsers,
      trending,
      popularPosts,
      recentBlogs,
      sparkTip,
    })
  } catch (error) {
    console.error("[v0] community/discover error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
