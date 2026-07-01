import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { PLANS, getOrCreateSubState, type PlanId } from "@/lib/subscription"
import { getOrCreateWallet } from "@/lib/wallet"

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const state = await getOrCreateSubState(userId)
    const now = Date.now()
    const last = state.lastMonthlyCoinAt ? new Date(state.lastMonthlyCoinAt).getTime() : 0

    if (now - last < MONTH_MS) {
      return NextResponse.json(
        { success: false, message: "Bonus mensile già riscosso.", nextAt: new Date(last + MONTH_MS) },
        { status: 429 },
      )
    }

    const amount = PLANS[state.plan as PlanId].monthlyCoins
    const wallet = await getOrCreateWallet(userId)
    wallet.coins += amount
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount,
      description: `Collex Coins mensili (${state.plan})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    state.lastMonthlyCoinAt = new Date()
    await state.save()

    return NextResponse.json({
      success: true,
      message: `+${amount} Collex Coins!`,
      amount,
      coins: wallet.coins,
      nextAt: new Date(now + MONTH_MS),
    })
  } catch (error) {
    console.error("[v0] subscription/coins/monthly error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
