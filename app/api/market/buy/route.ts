import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import { getAuthUserId } from "@/lib/auth/request"
import { lockPayment } from "@/lib/escrow"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { listingId } = body
    if (!listingId) {
      return NextResponse.json({ success: false, message: "ID annuncio mancante." }, { status: 400 })
    }

    await connectDB()
    const listing = await Listing.findById(listingId)
    if (!listing || listing.status !== "active") {
      return NextResponse.json({ success: false, message: "Annuncio non disponibile." }, { status: 404 })
    }
    if (String(listing.sellerId) === userId) {
      return NextResponse.json({ success: false, message: "Non puoi acquistare il tuo annuncio." }, { status: 400 })
    }

    const result = await lockPayment(userId, listing, listing.price)
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: result.message, escrow: result.escrow })
  } catch (error) {
    console.error("[v0] market/buy error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
