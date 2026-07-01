import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { LIVE_LIMITS, withinCooldown, moderateChatMessage, serializeLiveAuction } from "@/lib/live-shared"

// POST /api/live-auction/chat — posts a moderated live chat message.
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    const message = typeof body.message === "string" ? body.message : ""
    if (!id) return NextResponse.json({ success: false, message: "ID asta mancante." }, { status: 400 })

    // Anti-insult / anti-spam / anti-link moderation.
    const verdict = moderateChatMessage(message)
    if (!verdict.ok) return NextResponse.json({ success: false, message: verdict.reason }, { status: 400 })

    await connectDB()

    const auction = await LiveAuction.findById(id)
    if (!auction) return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })
    if (auction.status === "cancelled") {
      return NextResponse.json({ success: false, message: "Asta non disponibile." }, { status: 400 })
    }

    // Anti-spam: chat cooldown per user.
    const lastOwn = [...auction.chat].reverse().find((m: { userId: string }) => m.userId === userId)
    if (lastOwn && withinCooldown(lastOwn.createdAt, LIVE_LIMITS.chatCooldownMs)) {
      return NextResponse.json({ success: false, message: "Stai scrivendo troppo velocemente." }, { status: 429 })
    }

    const user = await User.findById(userId).select("username blocked").lean<{ username?: string; blocked?: boolean }>()
    if (user?.blocked) return NextResponse.json({ success: false, message: "Account bloccato." }, { status: 403 })

    auction.chat.push({
      userId,
      username: user?.username || "Utente",
      message: message.trim(),
      system: false,
      createdAt: new Date(),
    })
    // Keep the chat log bounded.
    if (auction.chat.length > 300) auction.chat = auction.chat.slice(-300)
    await auction.save()

    return NextResponse.json({ success: true, auction: serializeLiveAuction(auction.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-auction chat error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
