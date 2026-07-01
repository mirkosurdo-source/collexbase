import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, DAILY_REWARD, type Badge } from "@/lib/wallet"

const PERIOD_MS = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const wallet = await getOrCreateWallet(userId)
    const now = Date.now()
    const last = wallet.lastDailyReward ? new Date(wallet.lastDailyReward).getTime() : 0

    if (now - last < PERIOD_MS) {
      const nextAt = new Date(last + PERIOD_MS)
      return NextResponse.json(
        { success: false, message: "Ricompensa giornaliera già riscossa.", nextAt },
        { status: 429 },
      )
    }

    const reward = DAILY_REWARD[wallet.badge as Badge] ?? DAILY_REWARD.Base
    wallet.coins += reward
    wallet.lastDailyReward = new Date()
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount: reward,
      description: `Ricompensa giornaliera (${wallet.badge})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    return NextResponse.json({ success: true, message: `+${reward} CollexCoins!`, reward, coins: wallet.coins })
  } catch (error) {
    console.error("[v0] Errore ricompensa giornaliera:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
