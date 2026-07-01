import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateStripeCustomer } from "@/lib/payments"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"
import { getUserTier } from "@/lib/payments"
import { getPricedPackage } from "@/lib/coins-store"
import { connectDB } from "@/lib/db"
import CoinStorePurchase from "@/lib/models/CoinStorePurchase"
import { creditCoinPurchase } from "@/lib/coins-store-credit"

export const dynamic = "force-dynamic"

/**
 * Creates a Stripe Checkout Session for a coin package and returns its URL.
 *
 * Tier (Gold/Premium) discounts are computed server-side so the charged amount
 * can never be tampered with from the client. A pending CoinStorePurchase is
 * recorded; the /api/coins/confirm route credits the wallet once paid.
 *
 * Without Stripe configured (test mode) the purchase is credited immediately so
 * the flow stays usable end-to-end.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const packageId = String(body.packageId || "")

    const tier = await getUserTier(userId)
    const pkg = getPricedPackage(packageId, tier)
    if (!pkg) {
      return NextResponse.json({ success: false, message: "Pacchetto non valido." }, { status: 400 })
    }

    await connectDB()

    // Test mode: no Stripe key — credit immediately so the store is usable.
    if (!isStripeConfigured()) {
      const purchase = await CoinStorePurchase.create({
        userId,
        packageId: pkg.id,
        coins: pkg.coins,
        realValue: pkg.realValue,
        storePrice: pkg.storePrice,
        tier: pkg.tier,
        tierDiscountPct: pkg.tierDiscountPct,
        finalPrice: pkg.finalPrice,
        savings: pkg.savings,
        totalDiscountPct: pkg.totalDiscountPct,
        status: "pending",
      })
      await creditCoinPurchase(String(purchase._id))
      return NextResponse.json({
        success: true,
        configured: false,
        credited: true,
        coins: pkg.coins,
        savings: pkg.savings,
        message: "Modalità test: monete accreditate immediatamente.",
      })
    }

    const purchase = await CoinStorePurchase.create({
      userId,
      packageId: pkg.id,
      coins: pkg.coins,
      realValue: pkg.realValue,
      storePrice: pkg.storePrice,
      tier: pkg.tier,
      tierDiscountPct: pkg.tierDiscountPct,
      finalPrice: pkg.finalPrice,
      savings: pkg.savings,
      totalDiscountPct: pkg.totalDiscountPct,
      status: "pending",
    })

    const stripe = getStripe()
    const { customerId } = await getOrCreateStripeCustomer(userId)
    const origin = req.headers.get("origin") || new URL(req.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(pkg.finalPrice * 100),
            product_data: {
              name: `${pkg.coins.toLocaleString("it-IT")} CollexCoins`,
              description: `Pacchetto CollexCoins${pkg.tier !== "Base" ? ` · sconto ${pkg.tier}` : ""}`,
            },
          },
        },
      ],
      metadata: {
        userId: String(userId),
        purpose: "coins_store",
        purchaseId: String(purchase._id),
        packageId: pkg.id,
      },
      success_url: `${origin}/coins/store?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/coins/store?canceled=1`,
    })

    purchase.stripeSessionId = session.id
    await purchase.save()

    return NextResponse.json({ success: true, configured: true, url: session.url })
  } catch (err) {
    console.error("[v0] coins checkout error:", err)
    return NextResponse.json({ success: false, message: stripeErrorMessage(err) }, { status: 500 })
  }
}
