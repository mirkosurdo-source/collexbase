import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe, isStripeConfigured } from "@/lib/stripe"
import { connectDB } from "@/lib/db"
import {
  adjustWallet,
  recordPayment,
  markEscrowHeld,
  refundEscrow,
  disputeEscrow,
} from "@/lib/payments"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import { applyPlanChange, isPlanId, type BillingCycle } from "@/lib/subscription"
import { ensureSignupBonus } from "@/lib/collexcoin"
import { createNotification } from "@/lib/notifications"

// Stripe requires the raw request body to verify the signature.
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configurato." }, { status: 503 })
  }

  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = req.headers.get("stripe-signature")
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    if (!secret || !sig) throw new Error("Webhook secret o firma mancante.")
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error("[v0] webhook signature error:", err)
    return NextResponse.json({ error: "Firma webhook non valida." }, { status: 400 })
  }

  try {
    await connectDB()
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(pi)
        break
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent
        const userId = pi.metadata?.userId
        if (userId) {
          await recordPayment({
            userId,
            kind: (pi.metadata?.purpose as "deposit") || "deposit",
            amount: 0,
            status: "failed",
            stripePaymentIntentId: pi.id,
            description: "Pagamento fallito",
          })
          await createNotification({
            userId,
            type: "system",
            title: "Pagamento fallito",
            body: "Un tuo pagamento non è andato a buon fine.",
            link: "/payments",
          })
        }
        break
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
        if (piId) {
          const escrow = await PaymentEscrow.findOne({ stripePaymentIntentId: piId })
          if (escrow && escrow.status !== "refunded") await refundEscrow(String(escrow._id))
        }
        break
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute
        const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id
        if (piId) {
          const escrow = await PaymentEscrow.findOne({ stripePaymentIntentId: piId })
          if (escrow && escrow.status === "held") {
            await disputeEscrow(String(escrow._id), dispute.reason || "Disputa Stripe")
          }
        }
        break
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        await handleSubscriptionRenewal(invoice)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          await createNotification({
            userId,
            type: "system",
            title: "Abbonamento annullato",
            body: "Il tuo abbonamento è stato annullato.",
            link: "/subscription",
          })
        }
        break
      }
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[v0] webhook handler error:", err)
    return NextResponse.json({ error: "Errore nella gestione del webhook." }, { status: 500 })
  }
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const purpose = pi.metadata?.purpose
  const userId = pi.metadata?.userId
  const amount = (pi.amount_received || pi.amount || 0) / 100

  if (purpose === "deposit" && userId) {
    await adjustWallet(userId, { available: amount })
    await recordPayment({
      userId,
      kind: "deposit",
      amount,
      stripePaymentIntentId: pi.id,
      description: "Deposito carta",
    })
    return
  }

  if (purpose === "marketplace_escrow") {
    const escrow = await PaymentEscrow.findOne({ stripePaymentIntentId: pi.id })
    if (escrow) await markEscrowHeld(escrow)
    return
  }

  if (purpose === "trade_fee" && userId) {
    await recordPayment({
      userId,
      kind: "trade_fee",
      amount: -amount,
      stripePaymentIntentId: pi.id,
      description: "Commissione scambio pagata",
    })
    return
  }

  if (purpose === "subscription" && userId) {
    const plan = pi.metadata?.plan
    const cycle = (pi.metadata?.cycle as BillingCycle) || "monthly"
    if (isPlanId(plan)) {
      await applyPlanChange({ userId, toPlan: plan, cycle, event: "renew" })
      await ensureSignupBonus(userId)
    }
    await recordPayment({
      userId,
      kind: "subscription",
      amount: -amount,
      stripePaymentIntentId: pi.id,
      description: `Abbonamento ${plan || ""}`,
    })
  }
}

async function handleSubscriptionRenewal(invoice: Stripe.Invoice) {
  const userId = (invoice.metadata?.userId as string) || ""
  const plan = invoice.metadata?.plan
  const cycle = (invoice.metadata?.cycle as BillingCycle) || "monthly"
  if (!userId || !isPlanId(plan)) return

  await applyPlanChange({ userId, toPlan: plan, cycle, event: "renew" })
  await createNotification({
    userId,
    type: "system",
    title: "Abbonamento rinnovato",
    body: `Il tuo abbonamento ${plan} è stato rinnovato.`,
    link: "/subscription",
  })
}
