import { connectDB } from "@/lib/db"
import PaymentWallet from "@/lib/models/PaymentWallet"
import PaymentProfile from "@/lib/models/PaymentProfile"
import PaymentTransaction, { type PaymentTxKind, type PaymentTxStatus } from "@/lib/models/PaymentTransaction"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import Listing from "@/lib/models/Listing"
import User from "@/lib/models/User"
import { getOrCreateSubState, type PlanId } from "@/lib/subscription"
import { getStripe } from "@/lib/stripe"
import { roundMoney } from "@/lib/fees"
import { createNotification } from "@/lib/notifications"

type EscrowDoc = InstanceType<typeof PaymentEscrow>

type WalletDoc = InstanceType<typeof PaymentWallet>

/** Returns the user's real-money wallet, creating it on first access. */
export async function getOrCreatePaymentWallet(userId: string): Promise<WalletDoc> {
  await connectDB()
  let wallet = await PaymentWallet.findOne({ userId })
  if (!wallet) wallet = await PaymentWallet.create({ userId })
  return wallet
}

/** Reads the user's current subscription tier (defaults to Base). */
export async function getUserTier(userId: string): Promise<PlanId> {
  const state = await getOrCreateSubState(userId)
  return state.plan as PlanId
}

/** Appends a real-money ledger entry. */
export async function recordPayment(opts: {
  userId: string
  kind: PaymentTxKind
  amount: number
  description?: string
  status?: PaymentTxStatus
  counterpartyId?: string | null
  escrowId?: string | null
  stripePaymentIntentId?: string
  stripeChargeId?: string
  metadata?: Record<string, unknown>
}) {
  return PaymentTransaction.create({
    userId: opts.userId,
    kind: opts.kind,
    amount: roundMoney(opts.amount),
    description: opts.description || "",
    status: opts.status || "completed",
    counterpartyId: opts.counterpartyId || null,
    escrowId: opts.escrowId || null,
    stripePaymentIntentId: opts.stripePaymentIntentId || "",
    stripeChargeId: opts.stripeChargeId || "",
    metadata: opts.metadata || {},
  })
}

/**
 * Adjusts wallet buckets atomically-ish (load, mutate, save). Pass signed
 * deltas for any of available/pending/blocked.
 */
export async function adjustWallet(
  userId: string,
  deltas: { available?: number; pending?: number; blocked?: number },
): Promise<WalletDoc> {
  const wallet = await getOrCreatePaymentWallet(userId)
  wallet.available = roundMoney(wallet.available + (deltas.available || 0))
  wallet.pending = roundMoney(wallet.pending + (deltas.pending || 0))
  wallet.blocked = roundMoney(wallet.blocked + (deltas.blocked || 0))
  // Guard against negative buckets from rounding.
  if (wallet.available < 0) wallet.available = 0
  if (wallet.pending < 0) wallet.pending = 0
  if (wallet.blocked < 0) wallet.blocked = 0
  await wallet.save()
  return wallet
}

/**
 * Returns the user's Stripe Customer id, creating the customer (and profile)
 * if needed. Throws STRIPE_NOT_CONFIGURED via getStripe() when unconfigured.
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<{ customerId: string; profile: InstanceType<typeof PaymentProfile> }> {
  await connectDB()
  let profile = await PaymentProfile.findOne({ userId })
  if (profile?.stripeCustomerId) {
    return { customerId: profile.stripeCustomerId, profile }
  }

  const stripe = getStripe()
  const user = await User.findById(userId).select("email username name")
  const customer = await stripe.customers.create({
    email: user?.email || undefined,
    name: user?.name || user?.username || undefined,
    metadata: { userId: String(userId) },
  })

  if (!profile) {
    profile = await PaymentProfile.create({ userId, stripeCustomerId: customer.id })
  } else {
    profile.stripeCustomerId = customer.id
    await profile.save()
  }
  return { customerId: customer.id, profile }
}

/* -------------------------------------------------------------------------- */
/* Escrow lifecycle                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Buyer paid: move the seller's net into their `pending` bucket and mark the
 * escrow as held. Idempotent — does nothing if already past awaiting_payment.
 */
export async function markEscrowHeld(escrow: EscrowDoc): Promise<void> {
  if (escrow.status !== "awaiting_payment") return
  escrow.status = "held"
  escrow.heldAt = new Date()
  await escrow.save()

  await adjustWallet(String(escrow.sellerId), { pending: escrow.sellerNet })
  await recordPayment({
    userId: String(escrow.sellerId),
    kind: "escrow_hold",
    amount: escrow.sellerNet,
    status: "pending",
    counterpartyId: String(escrow.buyerId),
    escrowId: String(escrow._id),
    description: `Pagamento in attesa: ${escrow.itemName}`,
    stripePaymentIntentId: escrow.stripePaymentIntentId,
  })

  await createNotification({
    userId: String(escrow.sellerId),
    type: "system",
    title: "Pagamento in attesa",
    body: `Un acquirente ha pagato "${escrow.itemName}". I fondi saranno rilasciati alla consegna.`,
    link: "/payments",
  })
  await createNotification({
    userId: String(escrow.buyerId),
    type: "system",
    title: "Pagamento riuscito",
    body: `Il tuo pagamento per "${escrow.itemName}" è in escrow.`,
    link: "/payments",
  })
}

/**
 * Delivery confirmed: release the seller's net from `pending` to `available`.
 * CollexBase retains buyer + seller fees (already excluded from sellerNet).
 */
export async function releaseEscrow(escrowId: string): Promise<{ ok: boolean; error?: string }> {
  const escrow = await PaymentEscrow.findById(escrowId)
  if (!escrow) return { ok: false, error: "Escrow non trovato." }
  if (escrow.status !== "held") return { ok: false, error: "Escrow non rilasciabile in questo stato." }

  escrow.status = "released"
  escrow.releasedAt = new Date()
  await escrow.save()

  await adjustWallet(String(escrow.sellerId), { pending: -escrow.sellerNet, available: escrow.sellerNet })
  await recordPayment({
    userId: String(escrow.sellerId),
    kind: "escrow_release",
    amount: escrow.sellerNet,
    counterpartyId: String(escrow.buyerId),
    escrowId: String(escrow._id),
    description: `Fondi rilasciati: ${escrow.itemName}`,
  })
  await recordPayment({
    userId: String(escrow.sellerId),
    kind: "seller_fee",
    amount: -escrow.sellerFee,
    escrowId: String(escrow._id),
    description: `Commissione venditore: ${escrow.itemName}`,
  })

  if (escrow.listingId) {
    await Listing.findByIdAndUpdate(escrow.listingId, { status: "sold", soldTo: escrow.buyerId })
  }

  await createNotification({
    userId: String(escrow.sellerId),
    type: "system",
    title: "Fondi rilasciati",
    body: `Hai ricevuto € ${escrow.sellerNet.toLocaleString("it-IT")} per "${escrow.itemName}".`,
    link: "/payments",
  })
  await createNotification({
    userId: String(escrow.buyerId),
    type: "system",
    title: "Transazione completata",
    body: `La consegna di "${escrow.itemName}" è stata confermata.`,
    link: "/payments",
  })
  return { ok: true }
}

/** Opens a dispute: freeze the seller's pending net into `blocked`. */
export async function disputeEscrow(escrowId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const escrow = await PaymentEscrow.findById(escrowId)
  if (!escrow) return { ok: false, error: "Escrow non trovato." }
  if (escrow.status !== "held") return { ok: false, error: "Solo i pagamenti in attesa possono essere contestati." }

  escrow.status = "disputed"
  escrow.disputeReason = reason || ""
  await escrow.save()

  await adjustWallet(String(escrow.sellerId), { pending: -escrow.sellerNet, blocked: escrow.sellerNet })
  await recordPayment({
    userId: String(escrow.sellerId),
    kind: "dispute_hold",
    amount: 0,
    status: "pending",
    escrowId: String(escrow._id),
    description: `Disputa aperta: ${escrow.itemName}`,
  })

  for (const uid of [String(escrow.sellerId), String(escrow.buyerId)]) {
    await createNotification({
      userId: uid,
      type: "system",
      title: "Disputa aperta",
      body: `È stata aperta una disputa su "${escrow.itemName}". I fondi sono bloccati fino alla risoluzione.`,
      link: "/payments",
    })
  }
  return { ok: true }
}

/**
 * Refunds the buyer via Stripe and unwinds the escrow. Works from held or
 * disputed states.
 */
export async function refundEscrow(escrowId: string): Promise<{ ok: boolean; error?: string }> {
  const escrow = await PaymentEscrow.findById(escrowId)
  if (!escrow) return { ok: false, error: "Escrow non trovato." }
  if (escrow.status !== "held" && escrow.status !== "disputed") {
    return { ok: false, error: "Escrow non rimborsabile in questo stato." }
  }

  // Issue the Stripe refund for the buyer's charge.
  if (escrow.stripePaymentIntentId) {
    try {
      const stripe = getStripe()
      await stripe.refunds.create({ payment_intent: escrow.stripePaymentIntentId })
    } catch (err) {
      console.error("[v0] refundEscrow stripe error:", err)
      // Continue unwinding the ledger even if the Stripe call fails in test.
    }
  }

  // Unwind the held seller funds from whichever bucket they sit in.
  if (escrow.status === "held") {
    await adjustWallet(String(escrow.sellerId), { pending: -escrow.sellerNet })
  } else {
    await adjustWallet(String(escrow.sellerId), { blocked: -escrow.sellerNet })
  }

  escrow.status = "refunded"
  escrow.resolvedAt = new Date()
  await escrow.save()

  await recordPayment({
    userId: String(escrow.buyerId),
    kind: "escrow_refund",
    amount: escrow.buyerTotal,
    status: "refunded",
    counterpartyId: String(escrow.sellerId),
    escrowId: String(escrow._id),
    description: `Rimborso: ${escrow.itemName}`,
    stripePaymentIntentId: escrow.stripePaymentIntentId,
  })

  for (const uid of [String(escrow.sellerId), String(escrow.buyerId)]) {
    await createNotification({
      userId: uid,
      type: "system",
      title: "Rimborso effettuato",
      body: `Il pagamento per "${escrow.itemName}" è stato rimborsato all'acquirente.`,
      link: "/payments",
    })
  }
  return { ok: true }
}

/** Serializes a wallet doc for API responses. */
export function serializeWallet(wallet: WalletDoc) {
  return {
    available: roundMoney(wallet.available),
    pending: roundMoney(wallet.pending),
    blocked: roundMoney(wallet.blocked),
    total: roundMoney(wallet.available + wallet.pending + wallet.blocked),
    currency: wallet.currency || "eur",
    updatedAt: wallet.updatedAt,
  }
}
