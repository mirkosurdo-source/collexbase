import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateStripeCustomer, getUserTier } from "@/lib/payments"
import { calculateFeeBreakdown } from "@/lib/fees"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"
import Listing from "@/lib/models/Listing"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import { connectDB } from "@/lib/db"
import type { PlanId } from "@/lib/subscription"

/**
 * Starts a marketplace purchase: computes buyer/seller fees, creates a
 * PaymentEscrow (awaiting_payment) and a Stripe PaymentIntent for the buyer
 * total. The escrow transitions to "held" via the webhook on success.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    await connectDB()
    const body = await req.json()
    const listing = await Listing.findById(body.listingId)
    if (!listing) return NextResponse.json({ error: "Annuncio non trovato." }, { status: 404 })
    if (listing.status !== "active") {
      return NextResponse.json({ error: "Questo annuncio non è più disponibile." }, { status: 400 })
    }
    if (String(listing.sellerId) === userId) {
      return NextResponse.json({ error: "Non puoi acquistare un tuo annuncio." }, { status: 400 })
    }

    const buyerTier = await getUserTier(userId)
    const sellerTier = (listing.sellerBadge as PlanId) || (await getUserTier(String(listing.sellerId)))
    const breakdown = calculateFeeBreakdown({ amount: listing.price, buyerTier, sellerTier })

    // Reuse an existing awaiting_payment escrow for this buyer+listing if present.
    let escrow = await PaymentEscrow.findOne({
      listingId: listing._id,
      buyerId: userId,
      status: "awaiting_payment",
    })
    if (!escrow) {
      escrow = await PaymentEscrow.create({
        listingId: listing._id,
        itemName: listing.itemName,
        buyerId: userId,
        sellerId: listing.sellerId,
        buyerTier,
        sellerTier,
        amount: breakdown.amount,
        buyerFee: breakdown.buyerFee,
        sellerFee: breakdown.sellerFee,
        buyerTotal: breakdown.buyerTotal,
        sellerNet: breakdown.sellerNet,
        status: "awaiting_payment",
      })
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({
        escrowId: String(escrow._id),
        breakdown,
        configured: false,
        message: "Stripe non configurato: aggiungi STRIPE_SECRET_KEY per completare il pagamento.",
      })
    }

    const stripe = getStripe()
    const { customerId } = await getOrCreateStripeCustomer(userId)
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(breakdown.buyerTotal * 100),
      currency: "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userId),
        purpose: "marketplace_escrow",
        escrowId: String(escrow._id),
      },
    })

    escrow.stripePaymentIntentId = intent.id
    await escrow.save()

    return NextResponse.json({
      escrowId: String(escrow._id),
      breakdown,
      clientSecret: intent.client_secret,
      configured: true,
    })
  } catch (err) {
    console.error("[v0] marketplace checkout error:", err)
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
