import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { generateMarketplaceInsights } from "@/lib/advisor-insights"
import { persistInsights } from "@/lib/advisor-store"
import { createNotification } from "@/lib/notifications"

/**
 * Blocco 22 §4 — AI Advisor marketplace opportunities.
 * GET returns underpriced/overpriced listings and trusted sellers.
 * Pass ?notify=1 to notify about the best deals.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const notify = new URL(req.url).searchParams.get("notify") === "1"
    const insights = await generateMarketplaceInsights(userId)
    void persistInsights(userId, "marketplace", insights.cards)

    if (notify) {
      for (const deal of insights.underpriced.slice(0, 5)) {
        void createNotification({
          userId,
          type: "marketplace",
          title: `Occasione marketplace: ${deal.name}`,
          body: `Disponibile a € ${deal.price.toLocaleString("it-IT")}, sotto la stima di € ${deal.fair.toLocaleString("it-IT")}.`,
          context: { kind: "listing", id: deal.id },
        })
      }
    }

    return NextResponse.json({ success: true, ...insights })
  } catch (error) {
    console.error("[v0] ai/advisor/marketplace error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
