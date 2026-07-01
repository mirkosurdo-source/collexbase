import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { releaseEscrow } from "@/lib/payments"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import { connectDB } from "@/lib/db"

/**
 * Confirms delivery and releases escrowed funds to the seller. Only the buyer
 * (who received the item) may confirm delivery.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    await connectDB()
    const body = await req.json()
    const escrow = await PaymentEscrow.findById(body.escrowId)
    if (!escrow) return NextResponse.json({ error: "Escrow non trovato." }, { status: 404 })
    if (String(escrow.buyerId) !== userId) {
      return NextResponse.json({ error: "Solo l'acquirente può confermare la consegna." }, { status: 403 })
    }

    const result = await releaseEscrow(String(escrow._id))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[v0] deliver error:", err)
    return NextResponse.json({ error: "Errore durante il rilascio dei fondi." }, { status: 500 })
  }
}
