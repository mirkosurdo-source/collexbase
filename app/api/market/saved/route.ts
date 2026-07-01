import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import SavedListing from "@/lib/models/SavedListing"
import Listing from "@/lib/models/Listing"
import { getAuthUserId } from "@/lib/auth/request"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    await connectDB()

    const saved = await SavedListing.find({ userId }).sort({ createdAt: -1 }).lean()
    const ids = saved.map((s: Record<string, unknown>) => s.listingId)
    const listings = ids.length ? await Listing.find({ _id: { $in: ids } }).lean() : []

    return NextResponse.json({
      success: true,
      listings: listings.map((l: Record<string, unknown>) => ({ ...l, _id: String(l._id), saved: true })),
    })
  } catch (error) {
    console.error("[v0] market/saved error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
