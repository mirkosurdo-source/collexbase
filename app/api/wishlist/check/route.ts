import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { getAuthUserId } from "@/lib/auth/request"
import { checkWishlist } from "@/lib/wishlist-engine"
import {
  notifyWishlistOpportunity,
  notifyWishlistPriceDrop,
  notifyWishlistRare,
  notifyWishlistAuction,
  notifyWishlistNewListing,
} from "@/lib/ai-notifications"

export const dynamic = "force-dynamic"

/**
 * Blocco 24 §2 — POST /api/wishlist/check
 * Internal opportunity scanner (also used by the AI Advisor). Scans the
 * marketplace, trades and auctions for matches to the user's wishlist.
 *
 * Pass ?notify=1 to also emit CollexSpark notifications for the strongest
 * opportunity of each matched item (deduped by type).
 */
async function handle(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    await connectDB()
    const results = await checkWishlist(userId)
    const notify = new URL(req.url).searchParams.get("notify") === "1"

    if (notify) {
      const fired = new Set<string>()
      for (const r of results) {
        for (const op of r.opportunities) {
          const key = `${op.type}:${op.listingId ?? "none"}`
          if (fired.has(key)) continue
          fired.add(key)
          if (!op.listingId) continue
          switch (op.type) {
            case "price-drop":
              void notifyWishlistPriceDrop(userId, op.listingId, op.title, op.price ?? 0)
              break
            case "rare":
              void notifyWishlistRare(userId, op.listingId, op.title)
              break
            case "auction":
              void notifyWishlistAuction(userId, op.listingId, op.title, op.price ?? 0)
              break
            case "new-listing":
              void notifyWishlistNewListing(userId, op.listingId, op.title, op.price ?? 0)
              break
            case "marketplace":
              void notifyWishlistOpportunity(userId, op.listingId, op.title, op.price ?? 0)
              break
            // trades have no dedicated notifier; skip silently.
          }
        }
      }
    }

    const opportunities = results.flatMap((r) => r.opportunities)
    return NextResponse.json({ success: true, results, opportunities, totalOpportunities: opportunities.length })
  } catch (error) {
    console.error("[v0] POST /api/wishlist/check error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return handle(req)
}

// Allow GET for convenient polling from the client (no notifications by default).
export async function GET(req: Request) {
  return handle(req)
}
