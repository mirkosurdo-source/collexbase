import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
import { verifyToken } from "@/lib/auth/jwt"

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    await connectDB()

    // Auto-close expired auctions before listing.
    await Auction.updateMany(
      { status: "active", endsAt: { $lte: new Date() } },
      { $set: { status: "closed" } },
    )

    const auctions = await Auction.find({ status: "active" }).sort({ endsAt: 1 }).lean()

    const results = auctions.map((a: Record<string, unknown>) => ({
      _id: a._id,
      itemName: a.itemName,
      image: a.image,
      currentPrice: a.currentPrice,
      bidCount: Array.isArray(a.bids) ? a.bids.length : 0,
      endsAt: a.endsAt,
    }))

    return NextResponse.json({ success: true, auctions: results })
  } catch (error) {
    console.error("[v0] Errore list auctions:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
