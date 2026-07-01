import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { suggestPrice } from "@/lib/ai-advisor"
import { consumeAiCredit } from "@/lib/subscription"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const value = Number(body.value)
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ success: false, message: "Valore non valido." }, { status: 400 })
    }

    // Enforce the per-tier daily AI valuation limit (Premium is unlimited).
    const credit = await consumeAiCredit(userId)
    if (!credit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "Hai raggiunto il limite di valutazioni AI per oggi. Passa a un piano superiore per averne di più.",
          limitReached: true,
        },
        { status: 429 },
      )
    }

    const suggestion = suggestPrice({
      value,
      category: body.category || "",
      condition: body.condition || "",
      rarity: body.rarity || "Comune",
      year: typeof body.year === "number" ? body.year : null,
    })

    return NextResponse.json({
      success: true,
      suggestion,
      aiRemaining: Number.isFinite(credit.remaining) ? credit.remaining : null,
    })
  } catch (error) {
    console.error("[v0] market/ai/price error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
