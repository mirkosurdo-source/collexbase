import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import SavedPost from "@/lib/models/SavedPost"
import Follow from "@/lib/models/Follow"
import { getAuthUserId } from "@/lib/auth/request"

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id") || ""
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    const doc = await Post.findById(id).lean().catch(() => null)
    if (!doc) {
      return NextResponse.json({ success: false, message: "Post non trovato." }, { status: 404 })
    }
    const p = doc as Record<string, unknown>

    const userId = getAuthUserId(req)
    const likes = (p.likes as string[]) || []

    // Followers-only gate.
    if (p.visibility === "followers" && userId !== String(p.authorId)) {
      const follows = userId ? await Follow.findOne({ followerId: userId, sellerId: p.authorId }) : null
      if (!follows) {
        return NextResponse.json({ success: false, message: "Questo post è riservato ai follower." }, { status: 403 })
      }
    }

    const commentDocs = await Comment.find({ postId: id }).sort({ createdAt: 1 }).lean()
    const comments = commentDocs.map((c: Record<string, unknown>) => {
      const cl = (c.likes as string[]) || []
      return {
        id: String(c._id),
        parentId: c.parentId ? String(c.parentId) : null,
        authorId: String(c.authorId),
        authorUsername: c.authorUsername,
        authorAvatar: c.authorAvatar,
        body: c.body,
        mentions: c.mentions || [],
        likeCount: c.likeCount || 0,
        liked: userId ? cl.includes(userId) : false,
        createdAt: c.createdAt,
      }
    })

    let saved = false
    let followingAuthor = false
    if (userId) {
      saved = !!(await SavedPost.findOne({ userId, postId: id }))
      followingAuthor = !!(await Follow.findOne({ followerId: userId, sellerId: p.authorId }))
    }

    const post = {
      id: String(p._id),
      authorId: String(p.authorId),
      authorUsername: p.authorUsername,
      authorAvatar: p.authorAvatar,
      kind: p.kind,
      blogType: p.blogType,
      title: p.title,
      body: p.body,
      images: p.images || [],
      category: p.category,
      tags: p.tags || [],
      visibility: p.visibility,
      likeCount: p.likeCount || 0,
      commentCount: p.commentCount || 0,
      shareCount: p.shareCount || 0,
      liked: userId ? likes.includes(userId) : false,
      saved,
      followingAuthor,
      isOwner: userId === String(p.authorId),
      createdAt: p.createdAt,
    }

    return NextResponse.json({ success: true, post, comments })
  } catch (error) {
    console.error("[v0] community/post/item error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
