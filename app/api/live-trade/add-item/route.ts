import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { serializeLiveTrade } from "@/lib/live-shared"
import { isParticipant, sideOf, resetConfirmations, lazyExpireTrade } from "@/lib/live-trade-shared"

// POST /api/live-trade/add-item — add a card/item or set optional coins on the
// caller's side of the trade. Any change resets both confirmations (anti-scam).
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    if (!id) return NextResponse.json({ success: false, message: "ID scambio mancante." }, { status: 400 })

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const hasCoins = typeof body.coins === "number" && Number.isFinite(body.coins)
    if (!name && !hasCoins) {
      return NextResponse.json({ success: false, message: "Specifica un oggetto o un importo di coin." }, { status: 400 })
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
    const username = me?.username || "Utente"
    const side = sideOf(trade, userId)

    resetConfirmations(trade, username)

    if (name) {
      const item = {
        itemId: typeof body.itemId === "string" ? body.itemId : "",
        name,
        image: typeof body.image === "string" ? body.image.trim() : "",
        addedBy: userId,
      }
      if (side === "A") {
        if (trade.itemsA.length >= 20) {
          return NextResponse.json({ success: false, message: "Troppi oggetti nello scambio." }, { status: 400 })
        }
        trade.itemsA.push(item)
      } else {
        if (trade.itemsB.length >= 20) {
          return NextResponse.json({ success: false, message: "Troppi oggetti nello scambio." }, { status: 400 })
        }
        trade.itemsB.push(item)
      }
    }

    if (hasCoins) {
      const coins = Math.max(0, Math.floor(body.coins as number))
      if (side === "A") trade.coinsA = coins
      else trade.coinsB = coins
    }

    await trade.save()
    return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade add-item error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
