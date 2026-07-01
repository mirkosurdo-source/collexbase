import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, releaseMaturedCredits } from "@/lib/wallet"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: "Importo non valido." }, { status: 400 })
    }

    let wallet = await getOrCreateWallet(userId)
    wallet = await releaseMaturedCredits(wallet)

    if (amount > wallet.money) {
      return NextResponse.json({ success: false, message: "Saldo insufficiente." }, { status: 400 })
    }

    wallet.money -= amount
    wallet.transactions.push({
      type: "withdraw",
      currency: "money",
      amount,
      description: "Prelievo dal conto",
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    return NextResponse.json({ success: true, message: "Prelievo effettuato.", money: wallet.money }, { status: 200 })
  } catch (error) {
    console.error("[v0] Errore prelievo:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
