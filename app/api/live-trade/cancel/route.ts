import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { serializeLiveTrade } from "@/lib/live-shared"
import { isParticipant } from "@/lib/live-trade-shared"

// POST /api/live-trade/cancel — either participant cancels the live trade.
// Also used by the client when a user leaves the page (anti-scam auto-cancel).
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    if (!id) return NextResponse.json({ success: false, message: "ID scambio mancante." }, { status: 400 })

    await connectDB()
    const trade = await LiveTrade.findById(id)
    if (!trade) return NextResponse.json({ success: false, message: "Scambio non trovato." }, { status: 404 })
    if (!isParticipant(trade, userId)) {
      return NextResponse.json({ success: false, message: "Non fai parte di questo scambio." }, { status: 403 })
    }
    // Already finished — nothing to do.
    if (trade.status !== "live") {
      return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
    }

    const me = await User.findById(userId).select("username").lean<{ username?: string }>()
    trade.status = "cancelled"
    trade.chat.push({
      userId: "system",
      username: "Sistema",
      message: `${me?.username || "Un utente"} ha annullato lo scambio.`,
      system: true,
      createdAt: new Date(),
    })
    await trade.save()

    const otherId = String(trade.userA) === userId ? trade.userB : trade.userA
    void createNotification({
      userId: otherId,
      type: "trade",
      title: "Scambio live annullato",
      body: "La controparte ha annullato lo scambio.",
      link: `/trade/live/${trade._id}`,
    })

    return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade cancel error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
