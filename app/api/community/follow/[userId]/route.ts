import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import { getAuthUserId } from "@/lib/auth/request"

/** Blocco 25 — unfollow a user by id. */
export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const { userId: targetId } = await params
    if (!targetId) {
      return NextResponse.json({ success: false, message: "ID utente mancante." }, { status: 400 })
    }

    await connectDB()
    await Follow.deleteOne({ followerId: userId, sellerId: targetId })

    return NextResponse.json({ success: true, following: false, message: "Hai smesso di seguire l'utente." })
  } catch (error) {
    console.error("[v0] community/follow delete error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
