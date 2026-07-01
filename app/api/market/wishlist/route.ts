import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Wishlist from "@/lib/models/Wishlist"
import Listing from "@/lib/models/Listing"
import { getAuthUserId } from "@/lib/auth/request"
import { monitorWishlist } from "@/lib/ai-advisor"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    await connectDB()
    const wishlist = await Wishlist.findOne({ userId }).lean()
    const rawItems = (wishlist as Record<string, unknown> | null)?.items as Record<string, unknown>[] | undefined
    const items = rawItems || []

    // For each wishlist entry, find the cheapest active matching listing and
    // run the AI monitor against the user's target price.
    const enriched = await Promise.all(
      items.map(async (it) => {
        const name = String(it.name || "")
        const match = await Listing.findOne({
          status: "active",
          itemName: { $regex: name, $options: "i" },
        })
          .sort({ price: 1 })
          .lean()

        const marketPrice = match ? Number((match as Record<string, unknown>).price) : null
        const monitor = monitorWishlist(Number(it.targetPrice) || 0, marketPrice)

        return {
          _id: String(it._id),
          name,
          category: String(it.category || ""),
          targetPrice: Number(it.targetPrice) || 0,
          note: String(it.note || ""),
          marketPrice,
          listingId: match ? String((match as Record<string, unknown>)._id) : null,
          monitor,
        }
      }),
    )

    return NextResponse.json({ success: true, items: enriched })
  } catch (error) {
    console.error("[v0] wishlist list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
