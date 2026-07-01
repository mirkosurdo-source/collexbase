import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Comment from "@/lib/models/Comment"
import { getAuthUserId } from "@/lib/auth/request"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { commentId } = await req.json()
    if (!commentId) {
      return NextResponse.json({ success: false, message: "commentId mancante." }, { status: 400 })
    }

    await connectDB()
    const comment = await Comment.findById(commentId)
    if (!comment) {
      return NextResponse.json({ success: false, message: "Commento non trovato." }, { status: 404 })
    }

    const likes: string[] = comment.likes || []
    const has = likes.includes(userId)
    comment.likes = has ? likes.filter((u) => u !== userId) : [...likes, userId]
    comment.likeCount = comment.likes.length
    await comment.save()

    return NextResponse.json({ success: true, liked: !has, likeCount: comment.likeCount })
  } catch (error) {
    console.error("[v0] community/comment/like error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
