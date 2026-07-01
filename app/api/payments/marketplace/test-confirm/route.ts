import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { markEscrowHeld } from "@/lib/payments"
import { isStripeConfigured } from "@/lib/stripe"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import { connectDB } from "@/lib/db"

/**
 * Test-only confirmation used when Stripe keys are absent. Transitions the
 * buyer's escrow to "held" so the rest of the flow (deliver/dispute/release)
 * can be exercised without a live PaymentIntent. Disabled once Stripe is live.
 */
export async function POST(req: Request) {
  try {
    if (isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe è configurato: usa il pagamento reale." },
        { status: 400 },
      )
    }
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    await connectDB()
    const { escrowId } = await req.json()
    const escrow = await PaymentEscrow.findById(escrowId)
    if (!escrow) return NextResponse.json({ error: "Escrow non trovato." }, { status: 404 })
    if (String(escrow.buyerId) !== userId) {
      return NextResponse.json({ error: "Non autorizzato." }, { status: 403 })
    }

    await markEscrowHeld(escrow)
    return NextResponse.json({ ok: true, status: escrow.status })
  } catch (err) {
    console.error("[v0] test-confirm error:", err)
    return NextResponse.json({ error: "Errore interno." }, { status: 500 })
  }
}
