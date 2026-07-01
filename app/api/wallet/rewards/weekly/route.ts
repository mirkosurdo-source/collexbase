import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, WEEKLY_REWARD, type Badge } from "@/lib/wallet"

const PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const wallet = await getOrCreateWallet(userId)
    const now = Date.now()
    const last = wallet.lastWeeklyReward ? new Date(wallet.lastWeeklyReward).getTime() : 0

    if (now - last < PERIOD_MS) {
      const nextAt = new Date(last + PERIOD_MS)
      return NextResponse.json(
        { success: false, message: "Bonus settimanale già riscosso.", nextAt },
        { status: 429 },
      )
    }

    const reward = WEEKLY_REWARD[wallet.badge as Badge] ?? WEEKLY_REWARD.Base
    wallet.coins += reward
    wallet.lastWeeklyReward = new Date()
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount: reward,
      description: `Bonus settimanale (${wallet.badge})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    return NextResponse.json({ success: true, message: `+${reward} CollexCoins!`, reward, coins: wallet.coins })
  } catch (error) {
    console.error("[v0] Errore bonus settimanale:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
