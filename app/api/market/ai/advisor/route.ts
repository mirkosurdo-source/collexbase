import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { advisor, evaluateFairness } from "@/lib/ai-advisor"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()

    // Fairness mode: compare ask vs offer value.
    if (body.mode === "fairness") {
      const result = evaluateFairness({
        askValue: Number(body.askValue) || 0,
        offerValue: Number(body.offerValue) || 0,
      })
      return NextResponse.json({ success: true, fairness: result })
    }

    const result = advisor({
      mode: body.mode === "buy" ? "buy" : "sell",
      value: Number(body.value) || 0,
      category: body.category || "",
      condition: body.condition || "",
      rarity: body.rarity || "Comune",
      year: typeof body.year === "number" ? body.year : null,
      marketPrice: typeof body.marketPrice === "number" ? body.marketPrice : null,
    })

    return NextResponse.json({ success: true, advisor: result })
  } catch (error) {
    console.error("[v0] market/ai/advisor error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
