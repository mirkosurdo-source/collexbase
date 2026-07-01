import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"

const PAGE_SIZE = 12

/**
 * Dedicated feed for long-form blog/guide entries (kind = "blog").
 * Supports filtering by blogType (guide | discussion | help) and category,
 * and sorting by recent or popular. Only public entries are returned.
 */
export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)

    const blogType = searchParams.get("blogType") || ""
    const category = searchParams.get("category") || ""
    const sort = searchParams.get("sort") || "recent"
    const q = (searchParams.get("q") || "").trim()
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = { kind: "blog", visibility: "public" }
    if (["guide", "discussion", "help"].includes(blogType)) filter.blogType = blogType
    if (category) filter.category = category
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { body: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ]
    }

    const sortSpec: Record<string, 1 | -1> =
      sort === "popular" ? { likeCount: -1, commentCount: -1, createdAt: -1 } : { createdAt: -1 }

    const total = await Post.countDocuments(filter)
    const docs = await Post.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean()

    const posts = docs.map((p: Record<string, unknown>) => {
      const body = String(p.body || "")
      return {
        id: String(p._id),
        authorId: String(p.authorId),
        authorUsername: p.authorUsername,
        authorAvatar: p.authorAvatar,
        blogType: p.blogType,
        title: p.title,
        excerpt: body.length > 240 ? `${body.slice(0, 240)}...` : body,
        cover: Array.isArray(p.images) && p.images.length ? (p.images as string[])[0] : "",
        category: p.category,
        tags: p.tags || [],
        likeCount: p.likeCount || 0,
        commentCount: p.commentCount || 0,
        readMinutes: Math.max(1, Math.round(body.split(/\s+/).length / 200)),
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
    console.error("[v0] community/blog/list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
