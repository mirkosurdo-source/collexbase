import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { serializeLiveTrade } from "@/lib/live-shared"
import { isParticipant, sideOf, lazyExpireTrade } from "@/lib/live-trade-shared"

// POST /api/live-trade/confirm — caller confirms (or un-confirms) the trade.
// When both parties have confirmed, the trade is accepted (double confirm).
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    const confirm = body.confirm !== false
    if (!id) return NextResponse.json({ success: false, message: "ID scambio mancante." }, { status: 400 })

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
      return NextResponse.json({ success: false, message: "Lo scambio non è più attivo." }, { status: 400 })
    }
    // An empty trade can't be confirmed.
    if (confirm && trade.itemsA.length === 0 && trade.itemsB.length === 0 && trade.coinsA === 0 && trade.coinsB === 0) {
      return NextResponse.json({ success: false, message: "Aggiungi almeno un oggetto o dei coin." }, { status: 400 })
    }

    const me = await User.findById(userId).select("username").lean<{ username?: string }>()
    const username = me?.username || "Utente"
    const side = sideOf(trade, userId)
    if (side === "A") trade.confirmedA = confirm
    else trade.confirmedB = confirm

    trade.chat.push({
      userId: "system",
      username: "Sistema",
      message: confirm ? `${username} ha confermato lo scambio.` : `${username} ha annullato la conferma.`,
      system: true,
      createdAt: new Date(),
    })

    let completed = false
    if (trade.confirmedA && trade.confirmedB) {
      trade.status = "accepted"
      trade.completedAt = new Date()
      completed = true
      trade.chat.push({
        userId: "system",
        username: "Sistema",
        message: "Scambio completato: entrambi hanno confermato.",
        system: true,
        createdAt: new Date(),
      })
    }

    await trade.save()

    if (completed) {
      void createNotification({
        userId: trade.userA,
        type: "trade",
        title: "Scambio live completato",
        body: "Entrambe le parti hanno confermato lo scambio.",
        link: `/trade/live/${trade._id}`,
      })
      void createNotification({
        userId: trade.userB,
        type: "trade",
        title: "Scambio live completato",
        body: "Entrambe le parti hanno confermato lo scambio.",
        link: `/trade/live/${trade._id}`,
      })
    }

    return NextResponse.json({ success: true, completed, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade confirm error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
