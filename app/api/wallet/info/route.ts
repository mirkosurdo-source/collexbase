import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, releaseMaturedCredits, pendingLockedTotal } from "@/lib/wallet"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    let wallet = await getOrCreateWallet(userId)
    wallet = await releaseMaturedCredits(wallet)

    const lockedCredits = wallet.lockedCredits
      .filter((c: { released: boolean }) => !c.released)
      .map((c: { _id: unknown; amount: number; source: string; releaseAt: Date }) => ({
        id: String(c._id),
        amount: c.amount,
        source: c.source,
        releaseAt: c.releaseAt,
      }))

    return NextResponse.json(
      {
        success: true,
        wallet: {
          money: wallet.money,
          coins: wallet.coins,
          badge: wallet.badge,
          itemsVisibility: wallet.itemsVisibility,
          pendingLocked: pendingLockedTotal(wallet),
          lockedCredits,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Errore wallet info:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
