import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  PLANS,
  getOrCreateSubState,
  aiAvailability,
  type PlanId,
} from "@/lib/subscription"
import { getOrCreateWallet, releaseMaturedCredits } from "@/lib/wallet"
import Subscription from "@/lib/models/Subscription"

const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_MS = 30 * DAY_MS

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const state = await getOrCreateSubState(userId)
    const wallet = await releaseMaturedCredits(await getOrCreateWallet(userId))
    const subscription = await Subscription.findOne({ userId })

    const plan = state.plan as PlanId
    const perks = PLANS[plan]
    const ai = aiAvailability(state)

    const lastDaily = state.lastDailyCoinAt ? new Date(state.lastDailyCoinAt).getTime() : 0
    const lastMonthly = state.lastMonthlyCoinAt ? new Date(state.lastMonthlyCoinAt).getTime() : 0
    const now = Date.now()

    return NextResponse.json({
      success: true,
      plan,
      perks,
      billingCycle: state.billingCycle,
      subscription: subscription
        ? {
            status: subscription.status,
            price: subscription.price,
            autoRenew: subscription.autoRenew,
            startedAt: subscription.startedAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      ai: {
        unlimited: ai.unlimited,
        limit: ai.limit,
        used: ai.used,
        remaining: ai.unlimited ? null : ai.remaining,
        resetAt: ai.resetAt,
      },
      coins: {
        balance: wallet.coins,
        dailyAmount: perks.dailyCoins,
        monthlyAmount: perks.monthlyCoins,
        dailyAvailable: now - lastDaily >= DAY_MS,
        monthlyAvailable: now - lastMonthly >= MONTH_MS,
        nextDailyAt: lastDaily ? new Date(lastDaily + DAY_MS) : null,
        nextMonthlyAt: lastMonthly ? new Date(lastMonthly + MONTH_MS) : null,
      },
      signupBonus: {
        amount: perks.signupBonus,
        claimed: state.signupBonusClaimed,
      },
      money: wallet.money,
    })
  } catch (error) {
    console.error("[v0] subscription/get error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
