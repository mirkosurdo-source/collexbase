import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import SavedPost from "@/lib/models/SavedPost"
import { getAuthUserId } from "@/lib/auth/request"

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
    const existing = await SavedPost.findOne({ userId, postId })
    if (existing) {
      await SavedPost.deleteOne({ _id: existing._id })
      return NextResponse.json({ success: true, saved: false })
    }
    await SavedPost.create({ userId, postId })
    return NextResponse.json({ success: true, saved: true })
  } catch (error) {
    console.error("[v0] community/post/save error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
