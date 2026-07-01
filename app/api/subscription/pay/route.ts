import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateStripeCustomer } from "@/lib/payments"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"
import { applyPlanChange, planPrice, isPlanId, type BillingCycle } from "@/lib/subscription"
import { ensureSignupBonus } from "@/lib/collexcoin"

/**
 * Pays for / activates a subscription plan.
 *
 * With Stripe configured: creates a PaymentIntent (purpose=subscription); the
 * webhook applies the plan change on success. Without Stripe (test mode): the
 * plan change is applied immediately so the flow remains usable.
 *
 * Plan change side effects (handled by applyPlanChange + ensureSignupBonus):
 * updates UserSubscriptionState, logs SubscriptionHistory, syncs the wallet
 * badge, applies AI limits (via tier), and grants the Collex Coin signup bonus.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const plan = body.plan
    const cycle: BillingCycle = body.cycle === "yearly" ? "yearly" : "monthly"
    if (!isPlanId(plan)) {
      return NextResponse.json({ error: "Piano non valido." }, { status: 400 })
    }

    const price = planPrice(plan, cycle)

    // Free plan or test mode: apply immediately.
    if (price <= 0 || !isStripeConfigured()) {
      const result = await applyPlanChange({ userId, toPlan: plan, cycle, event: "upgrade" })
      const bonus = await ensureSignupBonus(userId)
      return NextResponse.json({
        ok: true,
        applied: true,
        plan,
        cycle,
        price,
        signupBonus: bonus.granted,
        coinBonus: result.grantedSignupBonus,
        configured: isStripeConfigured(),
      })
    }

    const stripe = getStripe()
    const { customerId } = await getOrCreateStripeCustomer(userId)
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userId),
        purpose: "subscription",
        plan,
        cycle,
      },
    })

    return NextResponse.json({ clientSecret: intent.client_secret, plan, cycle, price, configured: true })
  } catch (err) {
    console.error("[v0] subscription pay error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
