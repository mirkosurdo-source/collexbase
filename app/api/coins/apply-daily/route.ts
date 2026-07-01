import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { applyDailyReward } from "@/lib/collexcoin"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const result = await applyDailyReward(userId)

    return NextResponse.json({
      success: true,
      granted: result.granted,
      alreadyClaimed: result.alreadyClaimed,
      plan: result.plan,
      balance: result.balance,
      nextAvailableAt: result.nextAvailableAt,
      message: result.alreadyClaimed
        ? "Hai già riscattato le Collex Coin di oggi."
        : `Hai ricevuto ${result.granted} Collex Coin (piano ${result.plan}).`,
    })
  } catch (err) {
    console.error("[v0] coins/apply-daily error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
