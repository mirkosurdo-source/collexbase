import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { adjustWallet, recordPayment, getOrCreateStripeCustomer, serializeWallet, getOrCreatePaymentWallet } from "@/lib/payments"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"
import { roundMoney } from "@/lib/fees"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const amount = roundMoney(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Importo non valido." }, { status: 400 })
    }

    // Test / manual deposit: credit the wallet immediately (no Stripe).
    if (body.simulate === true || !isStripeConfigured()) {
      await adjustWallet(userId, { available: amount })
      await recordPayment({
        userId,
        kind: "deposit",
        amount,
        description: "Deposito manuale (test)",
      })
      const wallet = await getOrCreatePaymentWallet(userId)
      return NextResponse.json({ simulated: true, wallet: serializeWallet(wallet) })
    }

    // Real deposit: create a PaymentIntent; the wallet is credited by the
    // webhook when payment_intent.succeeded fires (metadata.purpose=deposit).
    const stripe = getStripe()
    const { customerId } = await getOrCreateStripeCustomer(userId)
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { userId: String(userId), purpose: "deposit" },
    })

    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id })
  } catch (err) {
    console.error("[v0] deposit error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
