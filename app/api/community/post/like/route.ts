import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"
import { createNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { postId } = await req.json()
    if (!postId) {
      return NextResponse.json({ success: false, message: "postId mancante." }, { status: 400 })
    }

    await connectDB()
    const post = await Post.findById(postId)
    if (!post) {
      return NextResponse.json({ success: false, message: "Post non trovato." }, { status: 404 })
    }

    const likes: string[] = post.likes || []
    const has = likes.includes(userId)
    if (has) {
      post.likes = likes.filter((u) => u !== userId)
    } else {
      post.likes = [...likes, userId]
    }
    post.likeCount = post.likes.length
    await post.save()

    // Notify author on a new like (not on unlike, not self-likes).
    if (!has && String(post.authorId) !== userId) {
      const actor = await getAuthor(userId)
      await createNotification({
        userId: String(post.authorId),
        type: "system",
        title: "Nuovo mi piace",
        body: `${actor?.username || "Un utente"} ha messo mi piace al tuo post.`,
        link: `/community/post/${postId}`,
      })
    }

    return NextResponse.json({ success: true, liked: !has, likeCount: post.likeCount })
  } catch (error) {
    console.error("[v0] community/post/like error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
