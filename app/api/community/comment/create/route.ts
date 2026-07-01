import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor, parseMentions, notifyMentions } from "@/lib/community"
import { createNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { postId, parentId, body } = await req.json()
    const text = (body || "").trim()
    if (!postId || !text) {
      return NextResponse.json({ success: false, message: "Contenuto mancante." }, { status: 400 })
    }
    if (text.length > 2000) {
      return NextResponse.json({ success: false, message: "Commento troppo lungo." }, { status: 400 })
    }

    await connectDB()
    const post = await Post.findById(postId)
    if (!post) {
      return NextResponse.json({ success: false, message: "Post non trovato." }, { status: 404 })
    }

    const author = await getAuthor(userId)
    if (!author) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    let resolvedParent: string | null = null
    let parentAuthorId = ""
    if (parentId) {
      const parent = await Comment.findById(parentId)
      if (parent && String(parent.postId) === String(postId)) {
        resolvedParent = String(parent._id)
        parentAuthorId = String(parent.authorId)
      }
    }

    const mentions = parseMentions(text)
    const comment = await Comment.create({
      postId,
      parentId: resolvedParent,
      authorId: userId,
      authorUsername: author.username,
      authorAvatar: author.avatar,
      body: text,
      mentions,
    })

    post.commentCount = (post.commentCount || 0) + 1
    await post.save()

    const link = `/community/${postId}`

    // Notify the post author (on top-level comments).
    if (!resolvedParent && String(post.authorId) !== userId) {
      await createNotification({
        userId: String(post.authorId),
        type: "system",
        title: "Nuovo commento",
        body: `${author.username || "Un utente"} ha commentato il tuo post.`,
        link,
      })
    }
    // Notify the parent comment author (on replies).
    if (resolvedParent && parentAuthorId && parentAuthorId !== userId) {
      await createNotification({
        userId: parentAuthorId,
        type: "system",
        title: "Nuova risposta",
        body: `${author.username || "Un utente"} ha risposto al tuo commento.`,
        link,
      })
    }
    // Notify mentioned users.
    await notifyMentions(mentions, author, link)

    return NextResponse.json({
      success: true,
      comment: {
        id: String(comment._id),
        parentId: resolvedParent,
        authorId: userId,
        authorUsername: author.username,
        authorAvatar: author.avatar,
        body: text,
        mentions,
        likeCount: 0,
        liked: false,
        createdAt: comment.createdAt,
      },
      commentCount: post.commentCount,
    })
  } catch (error) {
    console.error("[v0] community/comment/create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
