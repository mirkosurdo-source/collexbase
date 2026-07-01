import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getActiveBoosts, quoteAllTiers, BOOST_PRICES } from "@/lib/boost"
import { getOrCreateBalance } from "@/lib/collexcoin"
import { getOrCreateSubState, type PlanId } from "@/lib/subscription"

/** Active boosts of the current user, plus their tier and balance for pricing. */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const [active, balance, state] = await Promise.all([
      getActiveBoosts(userId),
      getOrCreateBalance(userId),
      getOrCreateSubState(userId),
    ])
    const plan = state.plan as PlanId

    return NextResponse.json({
      success: true,
      boosts: active,
      balance: balance.balance,
      plan,
      prices: BOOST_PRICES,
      quotes: {
        marketplace: quoteAllTiers("marketplace", plan),
        auction: quoteAllTiers("auction", plan),
        trade: quoteAllTiers("trade", plan),
        showcase: quoteAllTiers("showcase", plan),
      },
    })
  } catch (error) {
    console.error("[v0] boost/active error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
