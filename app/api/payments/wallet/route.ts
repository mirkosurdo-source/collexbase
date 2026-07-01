import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreatePaymentWallet, serializeWallet } from "@/lib/payments"
import PaymentTransaction from "@/lib/models/PaymentTransaction"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const wallet = await getOrCreatePaymentWallet(userId)
    const transactions = await PaymentTransaction.find({ userId }).sort({ createdAt: -1 }).limit(25).lean()

    return NextResponse.json({
      wallet: serializeWallet(wallet),
      transactions: transactions.map((t) => ({
        id: String(t._id),
        kind: t.kind,
        amount: t.amount,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] wallet GET error:", err)
    return NextResponse.json({ error: "Errore nel caricamento del wallet." }, { status: 500 })
  }
}
