import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import SavedListing from "@/lib/models/SavedListing"
import Follow from "@/lib/models/Follow"
import { getAuthUserId } from "@/lib/auth/request"
import { advisor } from "@/lib/ai-advisor"

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    const listing = await Listing.findById(id).lean()
    if (!listing) {
      return NextResponse.json({ success: false, message: "Annuncio non trovato." }, { status: 404 })
    }

    // Increment view counter (best-effort).
    Listing.updateOne({ _id: id }, { $inc: { viewsCount: 1 } }).catch(() => {})

    const doc = listing as Record<string, unknown>
    const userId = getAuthUserId(req)
    let saved = false
    let following = false
    let isOwner = false
    if (userId) {
      isOwner = String(doc.sellerId) === userId
      const [s, f] = await Promise.all([
        SavedListing.findOne({ userId, listingId: id }).lean(),
        Follow.findOne({ followerId: userId, sellerId: doc.sellerId }).lean(),
      ])
      saved = Boolean(s)
      following = Boolean(f)
    }

    // Buy-side AI advisor for the viewer.
    const buyAdvisor = advisor({
      mode: "buy",
      value: Number(doc.value) || Number(doc.price),
      category: String(doc.category || ""),
      condition: String(doc.condition || ""),
      rarity: String(doc.rarity || "Comune"),
      year: typeof doc.year === "number" ? (doc.year as number) : null,
      marketPrice: Number(doc.price),
    })

    return NextResponse.json({
      success: true,
      listing: { ...doc, _id: String(doc._id) },
      saved,
      following,
      isOwner,
      advisor: buyAdvisor,
    })
  } catch (error) {
    console.error("[v0] market/item error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
