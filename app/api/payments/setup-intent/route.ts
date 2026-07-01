import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateStripeCustomer } from "@/lib/payments"
import { getStripe, stripeErrorMessage } from "@/lib/stripe"

/** Creates a SetupIntent so the client can save a card for future payments. */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const stripe = getStripe()
    const { customerId } = await getOrCreateStripeCustomer(userId)

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { userId: String(userId) },
    })

    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (err) {
    console.error("[v0] setup-intent error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
