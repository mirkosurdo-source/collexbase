import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import SavedPost from "@/lib/models/SavedPost"
import { getAuthUserId } from "@/lib/auth/request"

/** Blocco 25 — author self-delete of a community post or blog entry. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const post = await Post.findById(id)
    if (!post) {
      return NextResponse.json({ success: false, message: "Post non trovato." }, { status: 404 })
    }
    if (String(post.authorId) !== userId) {
      return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 403 })
    }

    await Promise.all([
      post.deleteOne(),
      Comment.deleteMany({ postId: id }),
      SavedPost.deleteMany({ postId: id }),
    ])

    return NextResponse.json({ success: true, message: "Post eliminato." })
  } catch (error) {
    console.error("[v0] community/post delete error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
