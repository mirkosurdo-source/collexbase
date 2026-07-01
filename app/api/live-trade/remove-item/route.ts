import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { serializeLiveTrade } from "@/lib/live-shared"
import { isParticipant, sideOf, resetConfirmations, lazyExpireTrade } from "@/lib/live-trade-shared"

// POST /api/live-trade/remove-item — remove an item from the caller's side.
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    const itemKey = typeof body.itemKey === "string" ? body.itemKey : ""
    if (!id || !itemKey) {
      return NextResponse.json({ success: false, message: "Parametri mancanti." }, { status: 400 })
    }

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
      return NextResponse.json({ success: false, message: "Lo scambio non è modificabile." }, { status: 400 })
    }

    const me = await User.findById(userId).select("username").lean<{ username?: string }>()
    const side = sideOf(trade, userId)
    resetConfirmations(trade, me?.username || "Utente")

    const list = side === "A" ? trade.itemsA : trade.itemsB
    const idx = list.findIndex((it: { _id?: unknown }) => String(it._id) === itemKey)
    if (idx === -1) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }
    list.splice(idx, 1)

    await trade.save()
    return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade remove-item error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
