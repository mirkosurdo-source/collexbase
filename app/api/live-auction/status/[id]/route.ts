import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import { getAuthUserId } from "@/lib/auth/request"
import { serializeLiveAuction } from "@/lib/live-shared"
import { finalizeLiveAuctionIfEnded } from "@/lib/live-auction-finalize"

// GET /api/live-auction/status/[id] — polling endpoint for the live auction.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const viewerId = getAuthUserId(req)

    await connectDB()
    const auction = await LiveAuction.findById(id)
    if (!auction) return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })

    // Lazily finalize once the deadline has passed (no scheduler available).
    if (auction.status === "live" && new Date(auction.endAt).getTime() <= Date.now()) {
      await finalizeLiveAuctionIfEnded(auction)
    }

    return NextResponse.json({ success: true, auction: serializeLiveAuction(auction.toObject(), viewerId) })
  } catch (error) {
    console.error("[v0] live-auction status error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
