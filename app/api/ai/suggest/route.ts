import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import AIMetadata from "@/lib/models/AIMetadata"
import { isRarityHigh } from "@/lib/ai-valuation"

interface MetadataLean {
  name?: string
  rarity?: string | null
  marketValue?: { estimated?: number; min?: number; max?: number; trend?: "up" | "stable" | "down"; forecast30d?: number }
  duplicates?: { recommendedForSale?: number; recommendedForTrade?: number }
  advisor?: { sellNow?: boolean; hold?: boolean; auctionRecommended?: boolean; tradeRecommended?: boolean; reason?: string }
}

/**
 * Blocco 21 §9 — returns AI selling recommendations for a collection object,
 * used when creating a marketplace listing / trade / auction. It reads the
 * stored AIMetadata produced by /api/ai/analyze.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const objectId = typeof body.objectId === "string" ? body.objectId : ""
    if (!objectId) {
      return NextResponse.json({ success: false, message: "objectId mancante." }, { status: 400 })
    }

    await connectDB()
    const meta = await AIMetadata.findOne({ objectId, userId }).lean<MetadataLean>()

    if (!meta) {
      return NextResponse.json({
        success: true,
        analyzed: false,
        message: "Nessuna analisi AI disponibile. Esegui prima la valutazione AI dell'oggetto.",
      })
    }

    const market = meta.marketValue || {}
    const dup = meta.duplicates || {}
    const advisor = meta.advisor || {}
    const rare = isRarityHigh(meta.rarity)

    const trendAlert =
      market.trend === "up"
        ? "Trend in aumento: buon momento per vendere."
        : market.trend === "down"
          ? "Trend in calo: valuta se attendere."
          : "Valore stabile."

    return NextResponse.json({
      success: true,
      analyzed: true,
      suggestion: {
        recommendedPrice: market.estimated || 0,
        priceRange: { min: market.min || 0, max: market.max || 0 },
        forecast30d: market.forecast30d || 0,
        trend: market.trend || "stable",
        trendAlert,
        sellNow: !!advisor.sellNow,
        hold: !!advisor.hold,
        auctionRecommended: !!advisor.auctionRecommended,
        tradeRecommended: !!advisor.tradeRecommended || (dup.recommendedForTrade || 0) > 0,
        duplicateAlert:
          (dup.recommendedForSale || 0) > 0
            ? `Hai copie in eccesso: puoi venderne ${dup.recommendedForSale}.`
            : "",
        demandAlert: rare ? "Oggetto raro con domanda potenzialmente alta." : "",
        reason: advisor.reason || "",
      },
    })
  } catch (error) {
    console.error("[v0] ai/suggest error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
