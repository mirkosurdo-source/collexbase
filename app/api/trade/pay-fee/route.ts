import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getUserTier, getOrCreateStripeCustomer, recordPayment } from "@/lib/payments"
import { calculateTradeFee } from "@/lib/fees"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"

/**
 * Charges the trade settlement commission (Base 5% / Gold 3% / Premium 0%) for
 * a trade of the given EUR value. Creates a Stripe PaymentIntent and records a
 * pending ledger entry; Premium users (0% fee) skip payment entirely.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const tradeValue = Math.max(0, Number(body.tradeValue) || 0)
    if (tradeValue <= 0) {
      return NextResponse.json({ error: "Valore scambio non valido." }, { status: 400 })
    }

    const tier = await getUserTier(userId)
    const fee = calculateTradeFee(tier, tradeValue)

    // No fee for this tier (e.g. Premium): nothing to charge.
    if (fee <= 0) {
      return NextResponse.json({ ok: true, fee: 0, tier, free: true })
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ fee, tier, configured: false })
    }

    const stripe = getStripe()
    const { customerId } = await getOrCreateStripeCustomer(userId)
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(fee * 100),
      currency: "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userId),
        purpose: "trade_fee",
        tradeId: String(body.tradeId || ""),
      },
    })

    await recordPayment({
      userId,
      kind: "trade_fee",
      amount: -fee,
      status: "pending",
      stripePaymentIntentId: intent.id,
      description: "Commissione scambio (in attesa)",
      metadata: { tradeId: body.tradeId || "", tradeValue },
    })

    return NextResponse.json({ fee, tier, clientSecret: intent.client_secret, configured: true })
  } catch (err) {
    console.error("[v0] trade pay-fee error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
