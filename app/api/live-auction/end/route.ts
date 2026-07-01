import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import { getAuthUserId } from "@/lib/auth/request"
import { serializeLiveAuction } from "@/lib/live-shared"
import { finalizeLiveAuctionIfEnded } from "@/lib/live-auction-finalize"

// POST /api/live-auction/end — seller ends the auction now (generates order).
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    if (!id) return NextResponse.json({ success: false, message: "ID asta mancante." }, { status: 400 })

    await connectDB()
    const auction = await LiveAuction.findById(id)
    if (!auction) return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })

    if (auction.sellerId !== userId) {
      return NextResponse.json({ success: false, message: "Solo il venditore può terminare l'asta." }, { status: 403 })
    }
    if (auction.status !== "live") {
      return NextResponse.json({ success: false, message: "L'asta non è attiva." }, { status: 400 })
    }

    await finalizeLiveAuctionIfEnded(auction, { force: true })

    return NextResponse.json({ success: true, auction: serializeLiveAuction(auction.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-auction end error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
