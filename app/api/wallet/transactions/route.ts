import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet } from "@/lib/wallet"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const wallet = await getOrCreateWallet(userId)

    const transactions = [...wallet.transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((t: { _id: unknown; type: string; currency: string; amount: number; description: string; status: string; createdAt: Date }) => ({
        id: String(t._id),
        type: t.type,
        currency: t.currency,
        amount: t.amount,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt,
      }))

    return NextResponse.json({ success: true, transactions }, { status: 200 })
  } catch (error) {
    console.error("[v0] Errore wallet transactions:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
