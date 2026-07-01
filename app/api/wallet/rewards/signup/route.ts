import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, SIGNUP_BONUS, type Badge } from "@/lib/wallet"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const wallet = await getOrCreateWallet(userId)

    if (wallet.signupBonusClaimed) {
      return NextResponse.json({ success: false, message: "Bonus iscrizione già riscosso." }, { status: 429 })
    }

    const reward = SIGNUP_BONUS[wallet.badge as Badge] ?? SIGNUP_BONUS.Base
    wallet.coins += reward
    wallet.signupBonusClaimed = true
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount: reward,
      description: `Bonus iscrizione (${wallet.badge})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    return NextResponse.json({ success: true, message: `+${reward} CollexCoins!`, reward, coins: wallet.coins })
  } catch (error) {
    console.error("[v0] Errore bonus iscrizione:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
