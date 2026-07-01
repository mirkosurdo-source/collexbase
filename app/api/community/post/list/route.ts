import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Follow from "@/lib/models/Follow"
import SavedPost from "@/lib/models/SavedPost"
import { getAuthUserId } from "@/lib/auth/request"

const PAGE_SIZE = 10

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)

    const kind = searchParams.get("kind") === "blog" ? "blog" : "post"
    const feed = searchParams.get("feed") || "recent" // recent | popular | following | liked
    const category = searchParams.get("category") || ""
    const blogType = searchParams.get("blogType") || ""
    const authorId = searchParams.get("authorId") || ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const userId = getAuthUserId(req)

    // Resolve the set of authors whose followers-only posts the viewer may see.
    let followingIds: string[] = []
    if (userId) {
      const follows = await Follow.find({ followerId: userId }).select("sellerId").lean()
      followingIds = follows.map((f: Record<string, unknown>) => String(f.sellerId))
    }
    const visibleAuthors = userId ? [...followingIds, userId] : []

    const filter: Record<string, unknown> = {
      kind,
      $or: [{ visibility: "public" }, { visibility: "followers", authorId: { $in: visibleAuthors } }],
    }
    if (category) filter.category = category
    if (kind === "blog" && blogType) filter.blogType = blogType
    if (authorId) filter.authorId = authorId

    // "following" feed restricts to followed authors; "liked" to the viewer's likes.
    if (feed === "following") {
      filter.authorId = { $in: followingIds }
    }
    if (feed === "liked") {
      if (!userId) {
        return NextResponse.json({ success: true, posts: [], total: 0, page: 1, totalPages: 1 })
      }
      filter.likes = userId
    }

    const sort: Record<string, 1 | -1> = feed === "popular" ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 }

    const total = await Post.countDocuments(filter)
    const docs = await Post.find(filter)
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean()

    let savedIds = new Set<string>()
    if (userId) {
      const saved = await SavedPost.find({ userId, postId: { $in: docs.map((d: Record<string, unknown>) => d._id) } })
        .select("postId")
        .lean()
      savedIds = new Set(saved.map((s: Record<string, unknown>) => String(s.postId)))
    }

    const posts = docs.map((p: Record<string, unknown>) => {
      const likes = (p.likes as string[]) || []
      const body = String(p.body || "")
      return {
        id: String(p._id),
        authorId: String(p.authorId),
        authorUsername: p.authorUsername,
        authorAvatar: p.authorAvatar,
        kind: p.kind,
        blogType: p.blogType,
        title: p.title,
        excerpt: body.length > 280 ? `${body.slice(0, 280)}...` : body,
        images: p.images || [],
        category: p.category,
        tags: p.tags || [],
        likeCount: p.likeCount || 0,
        commentCount: p.commentCount || 0,
        shareCount: p.shareCount || 0,
        liked: userId ? likes.includes(userId) : false,
        saved: savedIds.has(String(p._id)),
        isOwner: userId ? String(p.authorId) === userId : false,
        followingAuthor: followingIds.includes(String(p.authorId)),
        createdAt: p.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      posts,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    })
  } catch (error) {
    console.error("[v0] community/post/list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
