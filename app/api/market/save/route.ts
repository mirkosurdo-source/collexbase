import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import SavedListing from "@/lib/models/SavedListing"
import Listing from "@/lib/models/Listing"
import { getAuthUserId } from "@/lib/auth/request"

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

    const existing = await SavedListing.findOne({ userId, listingId })
    if (existing) {
      await existing.deleteOne()
      await Listing.updateOne({ _id: listingId }, { $inc: { savedCount: -1 } })
      return NextResponse.json({ success: true, saved: false, message: "Annuncio rimosso dai salvati." })
    }

    await SavedListing.create({ userId, listingId })
    await Listing.updateOne({ _id: listingId }, { $inc: { savedCount: 1 } })
    return NextResponse.json({ success: true, saved: true, message: "Annuncio salvato." })
  } catch (error) {
    console.error("[v0] market/save error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
