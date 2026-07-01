import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import { getAuthUserId } from "@/lib/auth/request"
import { serializeLiveTrade } from "@/lib/live-shared"
import { isParticipant, lazyExpireTrade } from "@/lib/live-trade-shared"

// GET /api/live-trade/status/[id] — polling endpoint for the live trade.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const trade = await LiveTrade.findById(id)
    if (!trade) return NextResponse.json({ success: false, message: "Scambio non trovato." }, { status: 404 })
    if (!isParticipant(trade, userId)) {
      return NextResponse.json({ success: false, message: "Non fai parte di questo scambio." }, { status: 403 })
    }

    // Lazily cancel an expired session (no scheduler available).
    await lazyExpireTrade(trade)

    return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade status error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
