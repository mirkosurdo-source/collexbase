import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet, COIN_PACKAGES } from "@/lib/wallet"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const coins = Number(body.coins)

    const pkg = COIN_PACKAGES.find((p) => p.coins === coins)
    if (!pkg) {
      return NextResponse.json({ success: false, message: "Pacchetto monete non valido." }, { status: 400 })
    }

    const wallet = await getOrCreateWallet(userId)
    wallet.coins += pkg.coins
    wallet.transactions.push({
      type: "coins_purchase",
      currency: "coins",
      amount: pkg.coins,
      description: `Acquisto pacchetto ${pkg.coins} CollexCoins (€ ${pkg.price.toFixed(2)})`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()

    return NextResponse.json(
      { success: true, message: `Hai acquistato ${pkg.coins} CollexCoins.`, coins: wallet.coins },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Errore acquisto monete:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
