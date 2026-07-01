import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { LIVE_LIMITS, withinCooldown, moderateChatMessage, serializeLiveTrade } from "@/lib/live-shared"
import { isParticipant, lazyExpireTrade } from "@/lib/live-trade-shared"

// POST /api/live-trade/chat — posts a moderated message in the trade chat.
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    const message = typeof body.message === "string" ? body.message : ""
    if (!id) return NextResponse.json({ success: false, message: "ID scambio mancante." }, { status: 400 })

    const verdict = moderateChatMessage(message)
    if (!verdict.ok) return NextResponse.json({ success: false, message: verdict.reason }, { status: 400 })

    await connectDB()
    const trade = await LiveTrade.findById(id)
    if (!trade) return NextResponse.json({ success: false, message: "Scambio non trovato." }, { status: 404 })
    if (!isParticipant(trade, userId)) {
      return NextResponse.json({ success: false, message: "Non fai parte di questo scambio." }, { status: 403 })
    }
    if (await lazyExpireTrade(trade)) {
      return NextResponse.json({ success: false, message: "Tempo scaduto: scambio annullato." }, { status: 400 })
    }
    if (trade.status !== "live") {
      return NextResponse.json({ success: false, message: "Chat non disponibile." }, { status: 400 })
    }

    const lastOwn = [...trade.chat].reverse().find((m: { userId: string }) => m.userId === userId)
    if (lastOwn && withinCooldown(lastOwn.createdAt, LIVE_LIMITS.chatCooldownMs)) {
      return NextResponse.json({ success: false, message: "Stai scrivendo troppo velocemente." }, { status: 429 })
    }

    const me = await User.findById(userId).select("username blocked").lean<{ username?: string; blocked?: boolean }>()
    if (me?.blocked) return NextResponse.json({ success: false, message: "Account bloccato." }, { status: 403 })

    trade.chat.push({
      userId,
      username: me?.username || "Utente",
      message: message.trim(),
      system: false,
      createdAt: new Date(),
    })
    if (trade.chat.length > 300) trade.chat = trade.chat.slice(-300)
    await trade.save()

    return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade chat error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
