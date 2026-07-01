import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  recordTransaction,
  coinsForTrade,
  coinsForSale,
  applyPremiumDiscount,
} from "@/lib/collexcoin"
import { getOrCreateSubState, type PlanId } from "@/lib/subscription"
import type { CollexTxType } from "@/lib/models/CollexCoinTransaction"

/**
 * Consumes Collex Coin for an internal operation. Either pass an explicit
 * `amount` of coins, or a `purpose` ("trade" | "sale" | "feature") with a
 * `value` and the cost is computed from the user's tier (with Premium discount).
 * Always verifies the balance is sufficient before debiting.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const purpose = typeof body.purpose === "string" ? body.purpose : "feature"
    const state = await getOrCreateSubState(userId)
    const plan = state.plan as PlanId

    let cost = 0
    let type: CollexTxType = "spend"
    let description = typeof body.description === "string" ? body.description : ""

    if (purpose === "trade") {
      cost = coinsForTrade(plan, Number(body.value) || 0)
      type = "trade_fee"
      description = description || "Fee scambio in Collex Coin"
    } else if (purpose === "sale") {
      cost = coinsForSale(plan, Number(body.value) || 0)
      type = "sale_fee"
      description = description || "Fee vendita in Collex Coin"
    } else {
      // Generic feature/internal fee: explicit amount, with Premium discount.
      const requested = Math.max(0, Number(body.amount) || 0)
      cost = Math.round(applyPremiumDiscount(plan, requested).cost)
      type = "spend"
      description = description || "Utilizzo Collex Coin"
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      return NextResponse.json({ success: false, message: "Importo non valido." }, { status: 400 })
    }

    const result = await recordTransaction({ userId, amount: -cost, type, description })
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error, balance: result.balance }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      spent: cost,
      balance: result.balance,
      plan,
      message: `Hai utilizzato ${cost} Collex Coin.`,
    })
  } catch (err) {
    console.error("[v0] coins/use error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
