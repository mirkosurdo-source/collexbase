import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { generateAuctionInsights } from "@/lib/advisor-insights"
import { persistInsights } from "@/lib/advisor-store"
import { createNotification } from "@/lib/notifications"

/**
 * Blocco 22 §6 — AI Advisor auction opportunities.
 * GET returns undervalued auctions and own-item auction suggestions.
 * Pass ?notify=1 to notify about undervalued auctions.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const notify = new URL(req.url).searchParams.get("notify") === "1"
    const insights = await generateAuctionInsights(userId)
    void persistInsights(userId, "auctions", insights.cards)

    if (notify) {
      for (const a of insights.undervalued.slice(0, 5)) {
        void createNotification({
          userId,
          type: "auction",
          title: `Asta sottoprezzata: ${a.name}`,
          body: `Solo ${a.bids} offerte a € ${a.currentPrice.toLocaleString("it-IT")}. Entra ora!`,
          context: { kind: "auction", id: a.id },
        })
      }
    }

    return NextResponse.json({ success: true, ...insights })
  } catch (error) {
    console.error("[v0] ai/advisor/auctions error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
