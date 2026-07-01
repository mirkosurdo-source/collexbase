import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"
import { connectDB } from "@/lib/db"
import CoinStorePurchase from "@/lib/models/CoinStorePurchase"
import { creditCoinPurchase } from "@/lib/coins-store-credit"

export const dynamic = "force-dynamic"

/**
 * Confirms a coin-store checkout after the Stripe redirect.
 *
 * Verifies the Checkout Session is paid, then credits the matching pending
 * purchase to the wallet. Crediting is idempotent (see creditCoinPurchase), so
 * calling this multiple times for the same session is safe.
 *
 * This intentionally does NOT touch the global Stripe webhook — confirmation is
 * driven by verifying the session server-side on the success redirect.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const sessionId = String(body.sessionId || "")
    if (!sessionId) {
      return NextResponse.json({ success: false, message: "Sessione mancante." }, { status: 400 })
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ success: false, message: "Stripe non configurato." }, { status: 503 })
    }

    await connectDB()
    const purchase = await CoinStorePurchase.findOne({ stripeSessionId: sessionId })
    if (!purchase || String(purchase.userId) !== userId) {
      return NextResponse.json({ success: false, message: "Acquisto non trovato." }, { status: 404 })
    }

    // Already credited on a previous confirm — return success idempotently.
    if (purchase.status === "completed") {
      return NextResponse.json({
        success: true,
        alreadyCredited: true,
        coins: purchase.coins,
        savings: purchase.savings,
        tier: purchase.tier,
      })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { success: false, message: "Pagamento non ancora completato.", paymentStatus: session.payment_status },
        { status: 402 },
      )
    }

    const result = await creditCoinPurchase(String(purchase._id))
    if (!result.ok) {
      return NextResponse.json({ success: false, message: "Impossibile accreditare le monete." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      credited: true,
      coins: purchase.coins,
      savings: purchase.savings,
      tier: purchase.tier,
      balance: result.balance,
    })
  } catch (err) {
    console.error("[v0] coins confirm error:", err)
    return NextResponse.json({ success: false, message: stripeErrorMessage(err) }, { status: 500 })
  }
}
