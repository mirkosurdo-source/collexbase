import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateBalance, ensureSignupBonus, PREMIUM_COIN_DISCOUNT } from "@/lib/collexcoin"
import { getOrCreateSubState, PLANS, type PlanId } from "@/lib/subscription"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    // Settle any pending welcome bonus for the current tier on read.
    await ensureSignupBonus(userId)

    const state = await getOrCreateSubState(userId)
    const plan = state.plan as PlanId
    const bal = await getOrCreateBalance(userId)
    const perks = PLANS[plan]

    return NextResponse.json({
      success: true,
      balance: bal.balance,
      plan,
      lastDailyAt: bal.lastDailyAt,
      summary: {
        signupBonus: perks.signupBonus,
        signupBonusClaimed: (bal.claimedSignupPlans as string[]).includes(plan),
        dailyCoins: perks.dailyCoins,
        monthlyCoins: perks.monthlyCoins,
        premiumDiscountActive: plan === "Premium",
        premiumDiscountPct: plan === "Premium" ? PREMIUM_COIN_DISCOUNT : 0,
        tradeCoinsPct: perks.tradeCoinsPct,
      },
    })
  } catch (err) {
    console.error("[v0] coins/balance error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
