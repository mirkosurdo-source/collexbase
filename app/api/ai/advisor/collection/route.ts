import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { generateCollectionInsights } from "@/lib/advisor-insights"
import { persistInsights } from "@/lib/advisor-store"
import { notifyAuctionOpportunity, notifyGoodTimeToSell } from "@/lib/ai-notifications"

/**
 * Blocco 22 §3 — AI Advisor collection analysis.
 * GET returns the structured insights and persists them for the dashboard.
 * Pass ?notify=1 to also emit smart notifications (background refresh).
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const notify = new URL(req.url).searchParams.get("notify") === "1"
    const insights = await generateCollectionInsights(userId)
    void persistInsights(userId, "collection", insights.cards)

    if (notify) {
      for (const card of insights.cards) {
        const objectId = card.link?.split("/collections/")[1]
        if (card.id.startsWith("coll-sell-") && objectId) {
          void notifyGoodTimeToSell(userId, objectId, card.title.replace(/^Vendi\s+/, ""))
        } else if (card.id.startsWith("coll-auction-") && objectId) {
          void notifyAuctionOpportunity(userId, objectId, card.title.replace(/^Asta consigliata:\s+/, ""))
        }
      }
    }

    return NextResponse.json({ success: true, ...insights })
  } catch (error) {
    console.error("[v0] ai/advisor/collection error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
