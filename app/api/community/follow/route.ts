import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { notifyNewFollower } from "@/lib/community-notifications"

/**
 * Blocco 25 — community follow toggle by target user id.
 *
 * Reuses the existing Follow model (followerId -> sellerId) so the social graph
 * stays unified with the marketplace follow system. Does not touch
 * /api/market/follow.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const targetId = String(body.userId || body.sellerId || "").trim()
    if (!targetId) {
      return NextResponse.json({ success: false, message: "ID utente mancante." }, { status: 400 })
    }
    if (targetId === userId) {
      return NextResponse.json({ success: false, message: "Non puoi seguire te stesso." }, { status: 400 })
    }

    await connectDB()

    const existing = await Follow.findOne({ followerId: userId, sellerId: targetId })
    if (existing) {
      await existing.deleteOne()
      return NextResponse.json({ success: true, following: false, message: "Hai smesso di seguire l'utente." })
    }

    const [target, me] = await Promise.all([
      User.findById(targetId).select("username"),
      User.findById(userId).select("username"),
    ])
    if (!target) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    await Follow.create({ followerId: userId, sellerId: targetId, sellerUsername: target.username || "" })
    void notifyNewFollower({ followedUserId: targetId, followerUsername: me?.username || "" })

    return NextResponse.json({ success: true, following: true, message: "Ora segui questo collezionista." })
  } catch (error) {
    console.error("[v0] community/follow error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
