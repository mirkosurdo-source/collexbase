import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { generateTradeInsights } from "@/lib/advisor-insights"
import { persistInsights } from "@/lib/advisor-store"
import { createNotification } from "@/lib/notifications"

/**
 * Blocco 22 §5 — AI Advisor trade evaluation.
 * GET returns fairness evaluations and counter-proposal advice.
 * Pass ?notify=1 to notify about clearly advantageous incoming trades.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const notify = new URL(req.url).searchParams.get("notify") === "1"
    const insights = await generateTradeInsights(userId)
    void persistInsights(userId, "trades", insights.cards)

    if (notify) {
      for (const ev of insights.evaluations) {
        if (ev.role === "incoming" && ev.verdict === "ottima") {
          void createNotification({
            userId,
            type: "trade",
            title: `Scambio vantaggioso: ${ev.offeredItemName}`,
            body: `CollexSpark: ricevi ${ev.offeredItemName} per ${ev.requestedItemName}. Conviene accettare.`,
            context: { kind: "trade", id: ev.id },
          })
        }
      }
    }

    return NextResponse.json({ success: true, ...insights })
  } catch (error) {
    console.error("[v0] ai/advisor/trades error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
