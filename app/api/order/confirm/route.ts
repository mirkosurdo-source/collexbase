import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import StripeEscrow from "@/lib/models/StripeEscrow"
import { releaseEscrow } from "@/lib/stripe/connect"
import { stripeErrorMessage } from "@/lib/stripe"

/**
 * POST /api/order/confirm
 * The buyer confirms they received the item; we release the escrowed funds to
 * the seller via a real Stripe transfer (amount - commission).
 */
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string }
  if (!orderId) return NextResponse.json({ error: "orderId mancante." }, { status: 400 })

  await connectDB()

  const escrow = await StripeEscrow.findOne({ orderId })
  if (!escrow) return NextResponse.json({ error: "Deposito non trovato." }, { status: 404 })
  if (escrow.released) {
    return NextResponse.json({ error: "Pagamento già rilasciato." }, { status: 409 })
  }

  try {
    const result = await releaseEscrow(escrow)
    if (!result.ok) {
      const status = result.error === "ALREADY_RELEASED" ? 409 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ released: true, transferId: result.transferId })
  } catch (err) {
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
