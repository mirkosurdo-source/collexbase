import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { PLANS, getOrCreateSubState, type PlanId } from "@/lib/subscription"
import { getOrCreateWallet } from "@/lib/wallet"

const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const state = await getOrCreateSubState(userId)
    const now = Date.now()
    const last = state.lastDailyCoinAt ? new Date(state.lastDailyCoinAt).getTime() : 0

    if (now - last < DAY_MS) {
      return NextResponse.json(
        { success: false, message: "Bonus giornaliero già riscosso.", nextAt: new Date(last + DAY_MS) },
        { status: 429 },
      )
    }

    const amount = PLANS[state.plan as PlanId].dailyCoins
    const wallet = await getOrCreateWallet(userId)
    wallet.coins += amount
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount,
      description: `Collex Coins giornalieri (${state.plan})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    state.lastDailyCoinAt = new Date()
    await state.save()

    return NextResponse.json({
      success: true,
      message: `+${amount} Collex Coins!`,
      amount,
      coins: wallet.coins,
      nextAt: new Date(now + DAY_MS),
    })
  } catch (error) {
    console.error("[v0] subscription/coins/daily error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
