import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import Review from "@/lib/models/Review"

export const dynamic = "force-dynamic"

/** Admin moderation: delete a post (and its comments), a comment, or a review. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const type = String(body.type || "")
    const id = String(body.id || "")
    if (!id) return NextResponse.json({ success: false, message: "id mancante." }, { status: 400 })

    await connectDB()

    if (type === "post") {
      await Post.findByIdAndDelete(id)
      await Comment.deleteMany({ postId: id })
      return NextResponse.json({ success: true, message: "Post eliminato." })
    }
    if (type === "comment") {
      const comment = await Comment.findByIdAndDelete(id)
      if (comment?.postId) await Post.findByIdAndUpdate(comment.postId, { $inc: { commentCount: -1 } })
      return NextResponse.json({ success: true, message: "Commento eliminato." })
    }
    if (type === "review") {
      await Review.findByIdAndDelete(id)
      return NextResponse.json({ success: true, message: "Recensione eliminata." })
    }

    return NextResponse.json({ success: false, message: "Tipo non riconosciuto." }, { status: 400 })
  } catch (err) {
    console.error("[v0] admin/community/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
