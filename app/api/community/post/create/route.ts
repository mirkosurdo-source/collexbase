import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Post from "@/lib/models/Post"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"
import { notifyFollowersOfNewPost } from "@/lib/community-notifications"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json()
    const kind = body.kind === "blog" ? "blog" : "post"
    const text = (body.body || "").trim()
    const title = (body.title || "").trim()
    const blogType = ["guide", "discussion", "help"].includes(body.blogType) ? body.blogType : ""
    const category = (body.category || "").trim()
    const visibility = body.visibility === "followers" ? "followers" : "public"
    const images = Array.isArray(body.images) ? body.images.filter((i: unknown) => typeof i === "string").slice(0, 6) : []
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim().replace(/^#/, "")).filter(Boolean).slice(0, 8)
      : []

    if (kind === "blog" && !title) {
      return NextResponse.json({ success: false, message: "Il titolo è obbligatorio per i post del blog." }, { status: 400 })
    }
    if (!text && images.length === 0) {
      return NextResponse.json({ success: false, message: "Il contenuto non può essere vuoto." }, { status: 400 })
    }
    if (text.length > 8000) {
      return NextResponse.json({ success: false, message: "Contenuto troppo lungo." }, { status: 400 })
    }

    await connectDB()
    const author = await getAuthor(userId)
    if (!author) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    const post = await Post.create({
      authorId: userId,
      authorUsername: author.username,
      authorAvatar: author.avatar,
      kind,
      blogType: kind === "blog" ? blogType : "",
      title,
      body: text,
      images,
      category,
      tags,
      visibility,
    })

    // Blocco 25 — fan out a CollexSpark notification to the author's followers.
    // Fire-and-forget: never blocks or fails the publish flow.
    if (visibility === "public") {
      void notifyFollowersOfNewPost({
        authorId: userId,
        authorUsername: author.username,
        postId: String(post._id),
        kind,
        title,
        category,
      })
    }

    return NextResponse.json({ success: true, message: "Pubblicato.", id: String(post._id) })
  } catch (error) {
    console.error("[v0] community/post/create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
