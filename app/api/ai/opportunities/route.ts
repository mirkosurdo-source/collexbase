import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import Wishlist from "@/lib/models/Wishlist"
import Listing from "@/lib/models/Listing"
import { notifyWishlistOpportunity } from "@/lib/ai-notifications"

interface WishlistLean {
  items: { name: string; category?: string; targetPrice?: number }[]
}
interface ListingLean {
  _id: string
  itemName: string
  price: number
  image?: string
  rarity?: string
}

/**
 * Blocco 21 §8/§9 — matches the user's wishlist against active marketplace
 * listings and surfaces (and optionally notifies about) good opportunities,
 * e.g. "Oggetto wishlist disponibile a prezzo basso".
 *
 * Pass ?notify=1 to also emit notifications (used by background refreshes);
 * the default GET only returns matches for display.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const notify = searchParams.get("notify") === "1"

    await connectDB()
    const wishlist = await Wishlist.findOne({ userId }).lean<WishlistLean>()
    if (!wishlist || wishlist.items.length === 0) {
      return NextResponse.json({ success: true, opportunities: [] })
    }

    const opportunities: Array<{
      listingId: string
      name: string
      price: number
      targetPrice: number
      image: string
      belowTarget: boolean
    }> = []

    for (const wish of wishlist.items) {
      const name = (wish.name || "").trim()
      if (!name) continue
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

      const listings = await Listing.find({
        sellerId: { $ne: userId },
        status: "active",
        itemName: { $regex: escaped, $options: "i" },
      })
        .select("itemName price image rarity")
        .limit(5)
        .lean<ListingLean[]>()

      for (const listing of listings) {
        const target = wish.targetPrice || 0
        const belowTarget = target > 0 ? listing.price <= target : true
        opportunities.push({
          listingId: String(listing._id),
          name: listing.itemName,
          price: listing.price,
          targetPrice: target,
          image: listing.image || "",
          belowTarget,
        })

        if (notify && belowTarget) {
          void notifyWishlistOpportunity(userId, String(listing._id), listing.itemName, listing.price)
        }
      }
    }

    // Best deals (below target) first, then by price ascending.
    opportunities.sort((a, b) => Number(b.belowTarget) - Number(a.belowTarget) || a.price - b.price)

    return NextResponse.json({ success: true, opportunities })
  } catch (error) {
    console.error("[v0] ai/opportunities error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
