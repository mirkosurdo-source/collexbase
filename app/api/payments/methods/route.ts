import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateStripeCustomer } from "@/lib/payments"
import PaymentProfile from "@/lib/models/PaymentProfile"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"

/** Lists the user's saved payment methods (cards). */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    if (!isStripeConfigured()) {
      return NextResponse.json({ methods: [], configured: false })
    }

    const stripe = getStripe()
    const { customerId, profile } = await getOrCreateStripeCustomer(userId)

    const list = await stripe.paymentMethods.list({ customer: customerId, type: "card" })
    const methods = list.data.map((m) => ({
      id: m.id,
      brand: m.card?.brand || "",
      last4: m.card?.last4 || "",
      expMonth: m.card?.exp_month || 0,
      expYear: m.card?.exp_year || 0,
      isDefault: m.id === profile.defaultPaymentMethodId,
    }))

    return NextResponse.json({ methods, configured: true })
  } catch (err) {
    console.error("[v0] methods error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}

/** Removes a saved card. */
export async function DELETE(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const paymentMethodId = searchParams.get("id")
    if (!paymentMethodId) return NextResponse.json({ error: "Metodo non specificato." }, { status: 400 })

    const stripe = getStripe()
    await getOrCreateStripeCustomer(userId)
    await stripe.paymentMethods.detach(paymentMethodId)

    await PaymentProfile.findOneAndUpdate(
      { userId },
      { $pull: { methods: { paymentMethodId } } },
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[v0] methods DELETE error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
