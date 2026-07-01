import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import { getAuthUserId } from "@/lib/auth/request"
import { serializeLiveAuction } from "@/lib/live-shared"
import { markAuctionPaid } from "@/lib/auction-fines"

// POST /api/live-auction/pay — the winner completes payment within the 48h
// window, clearing the pending fine. Blocco 51.
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    if (!id) return NextResponse.json({ success: false, message: "ID asta mancante." }, { status: 400 })

    const result = await markAuctionPaid(id, userId)
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message || "Pagamento non riuscito." }, { status: 400 })
    }

    await connectDB()
    const auction = await LiveAuction.findById(id)
    return NextResponse.json({
      success: true,
      message: "Pagamento completato.",
      auction: auction ? serializeLiveAuction(auction.toObject(), userId) : null,
    })
  } catch (error) {
    console.error("[v0] live-auction pay error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
