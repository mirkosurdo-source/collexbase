import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import { getAuthUserId } from "@/lib/auth/request"

/** Blocco 25 — author self-delete of a comment (and its direct replies). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const comment = await Comment.findById(id)
    if (!comment) {
      return NextResponse.json({ success: false, message: "Commento non trovato." }, { status: 404 })
    }
    if (String(comment.authorId) !== userId) {
      return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 403 })
    }

    // Remove the comment plus any replies that hang off it.
    const replies = await Comment.find({ parentId: id }).select("_id").lean()
    const removed = 1 + replies.length

    await Promise.all([comment.deleteOne(), Comment.deleteMany({ parentId: id })])

    // Keep the post's denormalized counter consistent (never below zero).
    const post = await Post.findById(comment.postId)
    if (post) {
      post.commentCount = Math.max(0, (post.commentCount || 0) - removed)
      await post.save()
    }

    return NextResponse.json({ success: true, message: "Commento eliminato.", commentCount: post?.commentCount ?? 0 })
  } catch (error) {
    console.error("[v0] community/comment delete error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
