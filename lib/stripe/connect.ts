import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { connectDB } from "@/lib/db"
import StripeEscrow from "@/lib/models/StripeEscrow"
import SellerProfile from "@/lib/models/SellerProfile"

/**
 * BLOCCO FINALE — Stripe Connect helpers.
 *
 * Real money is handled exclusively by Stripe (Connect account + Transfer).
 * Nothing here is ever persisted as a spendable balance in our database.
 */

const ESCROW_WINDOW_MS = 48 * 60 * 60 * 1000

/** Creates a Stripe Express connected account for a seller. Returns its id. */
export async function createSellerAccount(email: string): Promise<string> {
  const stripe = getStripe()
  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: { transfers: { requested: true } },
  })
  return account.id
}

/**
 * Creates a Stripe onboarding (account_onboarding) link for a connected account.
 * `baseUrl` is used for the refresh/return URLs; it falls back to the public app
 * URL when omitted.
 */
export async function createOnboardingLink(accountId: string, baseUrl?: string): Promise<string> {
  const stripe = getStripe()
  const origin = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://collexbase.vercel.app"
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/seller/connect?status=refresh`,
    return_url: `${origin}/seller/dashboard?status=done`,
    type: "account_onboarding",
  })
  return link.url
}

/** Executes a real payout (Transfer) to a seller's connected account. */
export async function payoutToSeller({
  sellerStripeId,
  amount,
}: {
  sellerStripeId: string
  amount: number
}): Promise<Stripe.Transfer> {
  const stripe = getStripe()
  // `amount` is in cents; never transfer a non-positive amount.
  const safeAmount = Math.max(0, Math.round(amount))
  return stripe.transfers.create({
    amount: safeAmount,
    currency: "eur",
    destination: sellerStripeId,
  })
}

/**
 * Creates a real-money escrow record for an order whose Stripe payment has
 * already succeeded. Amounts are in cents. Idempotent on `orderId`.
 */
export async function createSellerEscrow(opts: {
  orderId: string
  sellerId: string
  sellerStripeId: string
  amount: number
  commission?: number
}): Promise<InstanceType<typeof StripeEscrow>> {
  await connectDB()
  const existing = await StripeEscrow.findOne({ orderId: opts.orderId })
  if (existing) return existing
  return StripeEscrow.create({
    orderId: opts.orderId,
    sellerId: opts.sellerId,
    sellerStripeId: opts.sellerStripeId,
    amount: Math.round(opts.amount),
    commission: Math.round(opts.commission || 0),
    released: false,
    autoReleaseAt: new Date(Date.now() + ESCROW_WINDOW_MS),
  })
}

export interface ReleaseResult {
  ok: boolean
  error?: string
  transferId?: string
}

/**
 * Releases a single escrow: transfers (amount - commission) to the seller, marks
 * it released, and updates the seller's lifetime payout total. Safe to call from
 * both buyer confirmation and the auto-release cron — it no-ops if already paid.
 */
export async function releaseEscrow(escrow: InstanceType<typeof StripeEscrow>): Promise<ReleaseResult> {
  if (escrow.released) return { ok: false, error: "ALREADY_RELEASED" }
  if (!escrow.sellerStripeId) return { ok: false, error: "SELLER_NOT_CONNECTED" }

  const net = Math.max(0, Math.round(escrow.amount - (escrow.commission || 0)))
  const transfer = await payoutToSeller({ sellerStripeId: escrow.sellerStripeId, amount: net })

  escrow.released = true
  escrow.releasedAt = new Date()
  escrow.transferId = transfer.id
  await escrow.save()

  // Update lifetime payout aggregate on the seller profile (stat only, in euros).
  await SellerProfile.updateOne(
    { userId: escrow.sellerId },
    { $inc: { totalPayout: net / 100 } },
  )

  return { ok: true, transferId: transfer.id }
}
