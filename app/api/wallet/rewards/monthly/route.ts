import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, MONTHLY_REWARD, type Badge } from "@/lib/wallet"

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const wallet = await getOrCreateWallet(userId)
    const now = Date.now()
    const last = wallet.lastMonthlyReward ? new Date(wallet.lastMonthlyReward).getTime() : 0

    if (now - last < PERIOD_MS) {
      const nextAt = new Date(last + PERIOD_MS)
      return NextResponse.json(
        { success: false, message: "Bonus mensile già riscosso.", nextAt },
        { status: 429 },
      )
    }

    const reward = MONTHLY_REWARD[wallet.badge as Badge] ?? MONTHLY_REWARD.Base
    wallet.coins += reward
    wallet.lastMonthlyReward = new Date()
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount: reward,
      description: `Bonus mensile (${wallet.badge})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    return NextResponse.json({ success: true, message: `+${reward} CollexCoins!`, reward, coins: wallet.coins })
  } catch (error) {
    console.error("[v0] Errore bonus mensile:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
