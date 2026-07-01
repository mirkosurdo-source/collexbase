import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { generateWishlistInsights } from "@/lib/advisor-insights"
import { persistInsights } from "@/lib/advisor-store"
import { notifyWishlistOpportunity } from "@/lib/ai-notifications"

/**
 * Blocco 22 §7 — AI Advisor wishlist opportunities.
 * GET returns wishlist items currently available in the marketplace.
 * Pass ?notify=1 to notify about items available below target price.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const notify = new URL(req.url).searchParams.get("notify") === "1"
    const insights = await generateWishlistInsights(userId)
    void persistInsights(userId, "wishlist", insights.cards)

    if (notify) {
      for (const m of insights.matches) {
        if (m.belowTarget) {
          void notifyWishlistOpportunity(userId, m.listingId, m.name, m.price)
        }
      }
    }

    return NextResponse.json({ success: true, ...insights })
  } catch (error) {
    console.error("[v0] ai/advisor/wishlist error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
