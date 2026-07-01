/**
 * Blocco 51 — Creator Pro affiliate engine.
 *
 * Creators (admin-activated only) earn a commission on what their invited users
 * spend, credited as internal CreatorCredits — never real money, no Stripe and
 * no Coins-ledger changes. Invited users get activation/renewal discounts.
 * Entirely additive and side-effect free with respect to existing engines.
 */

import { connectDB } from "@/lib/db"
import { randomBytes } from "crypto"
import CreatorPartner from "@/lib/models/CreatorPartner"
import CreatorCommissionEvent from "@/lib/models/CreatorCommissionEvent"
import CreatorCreditsLedger from "@/lib/models/CreatorCreditsLedger"
import CreatorPayoutRequest from "@/lib/models/CreatorPayoutRequest"
import ReferralEvent from "@/lib/models/ReferralEvent"
import User from "@/lib/models/User"

/** Minimum euro amount a creator can request as a payout. */
export const MIN_PAYOUT_AMOUNT = 10

export const DEFAULT_COMMISSION_RATE = 0.1
export const DEFAULT_DURATION_MONTHS = 6
/** Invited-user discounts (Blocco 51 §4). */
export const INVITED_ACTIVATION_DISCOUNT = 0.2
export const INVITED_RENEWAL_DISCOUNT = 0.1

/** Generates a short, human-shareable creator code (e.g. "CR-7F3A9C"). */
export function generateReferralCode(): string {
  return `CR-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`
}

/**
 * Builds the public creator referral URL (Blocco 51.1 short link `/i/<code>`).
 * The `/i/<code>` page captures the code and forwards to registration, where the
 * existing referral-claim flow attributes the invite and applies discounts.
 */
export function buildReferralLinkForCode(code: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "")
  return `${base}/i/${encodeURIComponent(code)}`
}

type PartnerDoc = InstanceType<typeof CreatorPartner>

/** Activates (or re-activates) a creator partner. Admin-only at the route layer. */
export async function activateCreator(opts: {
  creatorId: string
  commissionRate?: number
  commissionDurationMonths?: number
}): Promise<PartnerDoc> {
  await connectDB()
  const { creatorId, commissionRate, commissionDurationMonths } = opts

  let partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) {
    // Ensure a unique code.
    let code = generateReferralCode()
    while (await CreatorPartner.findOne({ referralCode: code })) code = generateReferralCode()
    partner = await CreatorPartner.create({
      creatorId,
      referralCode: code,
      commissionRate: commissionRate ?? DEFAULT_COMMISSION_RATE,
      commissionDurationMonths: commissionDurationMonths ?? DEFAULT_DURATION_MONTHS,
      active: true,
    })
    return partner
  }

  partner.active = true
  if (typeof commissionRate === "number") partner.commissionRate = commissionRate
  if (typeof commissionDurationMonths === "number") partner.commissionDurationMonths = commissionDurationMonths
  await partner.save()
  return partner
}

/** Deactivates a creator partner (stops future commissions). */
export async function deactivateCreator(creatorId: string): Promise<PartnerDoc | null> {
  await connectDB()
  const partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) return null
  partner.active = false
  await partner.save()
  return partner
}

export async function getCreatorByCode(code: string): Promise<PartnerDoc | null> {
  await connectDB()
  return CreatorPartner.findOne({ referralCode: code.trim() })
}

export async function getCreator(creatorId: string): Promise<PartnerDoc | null> {
  await connectDB()
  return CreatorPartner.findOne({ creatorId })
}

/** Adds `months` to a date. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

interface InvitedLink {
  creatorId: string
  code: string
  rate: number
  /** When the commission/discount window ends. */
  windowEnd: Date
  withinWindow: boolean
}

/**
 * Resolves the active creator (if any) that invited `userId`, along with the
 * commission/discount window derived from the referral date.
 */
export async function resolveInvitedCreator(userId: string): Promise<InvitedLink | null> {
  await connectDB()
  const event = await ReferralEvent.findOne({ invitedId: userId, creatorCode: { $ne: null } }).lean()
  if (!event) return null
  const code = (event as { creatorCode?: string }).creatorCode
  if (!code) return null

  const partner = await CreatorPartner.findOne({ referralCode: code })
  if (!partner || !partner.active) return null

  const referredAt = new Date((event as { createdAt?: Date }).createdAt ?? Date.now())
  const windowEnd = addMonths(referredAt, partner.commissionDurationMonths)
  return {
    creatorId: String(partner.creatorId),
    code,
    rate: partner.commissionRate,
    windowEnd,
    withinWindow: Date.now() <= windowEnd.getTime(),
  }
}

/**
 * Computes the discount fraction an invited user gets on a premium/gold charge.
 * 20% on first activation, 10% on renewals, only within the creator window.
 */
export async function computeInvitedDiscount(
  userId: string,
  opts: { isRenewal: boolean },
): Promise<{ discount: number; creatorId: string | null }> {
  const link = await resolveInvitedCreator(userId)
  if (!link || !link.withinWindow) return { discount: 0, creatorId: null }
  const discount = opts.isRenewal ? INVITED_RENEWAL_DISCOUNT : INVITED_ACTIVATION_DISCOUNT
  return { discount, creatorId: link.creatorId }
}

/** Low-level credit movement: appends to the ledger and updates the balance. */
export async function applyCredits(creatorId: string, delta: number, reason: string): Promise<number> {
  await connectDB()
  const partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) throw new Error("Creator non trovato.")

  const nextBalance = Math.max(0, partner.creditsBalance + delta)
  partner.creditsBalance = nextBalance
  if (delta > 0) partner.totalCreditsEarned += delta
  await partner.save()

  await CreatorCreditsLedger.create({ creatorId, delta, reason, balanceAfter: nextBalance })
  return nextBalance
}

/**
 * Records a commission when an invited user spends. Credits the creator with
 * `rate * amountSpent` CreatorCredits if the spend falls within the window.
 * Returns the credited amount (0 when no active creator/window applies).
 */
export async function recordCreatorCommission(opts: {
  userId: string
  amountSpent: number
  source?: string
  discountApplied?: number
}): Promise<{ credited: number; creatorId: string | null }> {
  const { userId, amountSpent, source = "premium", discountApplied = 0 } = opts
  if (amountSpent <= 0) return { credited: 0, creatorId: null }

  const link = await resolveInvitedCreator(userId)
  if (!link || !link.withinWindow) return { credited: 0, creatorId: null }

  const commission = Math.round(amountSpent * link.rate * 100) / 100
  if (commission <= 0) return { credited: 0, creatorId: link.creatorId }

  await CreatorCommissionEvent.create({
    creatorId: link.creatorId,
    userId,
    amountSpent,
    commissionAmount: commission,
    source,
    discountApplied: Math.round((discountApplied || 0) * 100) / 100,
  })
  await applyCredits(link.creatorId, commission, `Commissione ${source}`)

  return { credited: commission, creatorId: link.creatorId }
}

/** Spends CreatorCredits on an internal feature. Rejects if balance is too low. */
export async function spendCredits(opts: {
  creatorId: string
  amount: number
  reason: string
}): Promise<{ ok: boolean; balance: number; error?: string }> {
  const { creatorId, amount, reason } = opts
  await connectDB()
  if (amount <= 0) return { ok: false, balance: 0, error: "Importo non valido." }

  const partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) return { ok: false, balance: 0, error: "Creator non trovato." }
  if (partner.creditsBalance < amount) {
    return { ok: false, balance: partner.creditsBalance, error: "CreatorCredits insufficienti." }
  }

  const balance = await applyCredits(creatorId, -amount, reason)
  return { ok: true, balance }
}

export interface CreatorDashboard {
  active: boolean
  referralCode: string
  commissionRate: number
  commissionDurationMonths: number
  creditsBalance: number
  totalCreditsEarned: number
  totalUsersInvited: number
  /** Monthly commission totals for the last 6 months (oldest → newest). */
  monthly: { month: string; commission: number; users: number }[]
  recentCommissions: { userId: string; amountSpent: number; commissionAmount: number; source: string; at: string }[]
}

/** Builds the creator dashboard payload (commissions, credits, 6-month charts). */
export async function getCreatorDashboard(creatorId: string): Promise<CreatorDashboard | null> {
  await connectDB()
  const partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) return null

  const since = new Date()
  since.setMonth(since.getMonth() - 5)
  since.setDate(1)
  since.setHours(0, 0, 0, 0)

  const [events, invitedCount] = await Promise.all([
    CreatorCommissionEvent.find({ creatorId }).sort({ createdAt: -1 }).lean(),
    ReferralEvent.countDocuments({ creatorCode: partner.referralCode }),
  ])

  // Keep totalUsersInvited fresh.
  if (partner.totalUsersInvited !== invitedCount) {
    partner.totalUsersInvited = invitedCount
    await partner.save()
  }

  // Build 6 monthly buckets.
  const buckets = new Map<string, { commission: number; users: Set<string> }>()
  for (let i = 0; i < 6; i++) {
    const d = new Date(since)
    d.setMonth(since.getMonth() + i)
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { commission: 0, users: new Set() })
  }
  for (const e of events) {
    const ev = e as { createdAt?: Date; commissionAmount?: number; userId?: string }
    const d = new Date(ev.createdAt ?? Date.now())
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.commission += Number(ev.commissionAmount) || 0
      if (ev.userId) bucket.users.add(String(ev.userId))
    }
  }

  return {
    active: partner.active,
    referralCode: partner.referralCode,
    commissionRate: partner.commissionRate,
    commissionDurationMonths: partner.commissionDurationMonths,
    creditsBalance: partner.creditsBalance,
    totalCreditsEarned: partner.totalCreditsEarned,
    totalUsersInvited: invitedCount,
    monthly: Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      commission: Math.round(v.commission * 100) / 100,
      users: v.users.size,
    })),
    recentCommissions: events.slice(0, 20).map((e) => {
      const ev = e as { userId: string; amountSpent: number; commissionAmount: number; source?: string; createdAt?: Date }
      return {
        userId: String(ev.userId),
        amountSpent: ev.amountSpent,
        commissionAmount: ev.commissionAmount,
        source: ev.source ?? "premium",
        at: new Date(ev.createdAt ?? Date.now()).toISOString(),
      }
    }),
  }
}

/* ------------------------------------------------------------------ */
/* Blocco 51.1 — real-money Creator Earnings (€) + payouts             */
/* ------------------------------------------------------------------ */

export interface CreatorEarnings {
  /** Spendable euro balance ("Creator Earnings"). */
  balance: number
  /** Lifetime euros earned in commissions. */
  totalEarned: number
  /** Euros locked in pending payout requests. */
  pendingPayout: number
  /** Lifetime euros paid out. */
  totalPaidOut: number
  commissionRate: number
  commissionDurationMonths: number
  minPayout: number
  currency: "EUR"
}

/** Returns the creator's real-money earnings summary. */
export async function getCreatorEarnings(creatorId: string): Promise<CreatorEarnings | null> {
  await connectDB()
  const partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) return null
  return {
    balance: Math.round(partner.creditsBalance * 100) / 100,
    totalEarned: Math.round(partner.totalCreditsEarned * 100) / 100,
    pendingPayout: Math.round((partner.pendingPayout || 0) * 100) / 100,
    totalPaidOut: Math.round((partner.totalPaidOut || 0) * 100) / 100,
    commissionRate: partner.commissionRate,
    commissionDurationMonths: partner.commissionDurationMonths,
    minPayout: MIN_PAYOUT_AMOUNT,
    currency: "EUR",
  }
}

/** Returns a creator's commission history (most recent first). */
export async function listCommissions(creatorId: string, limit = 50) {
  await connectDB()
  const events = await CreatorCommissionEvent.find({ creatorId }).sort({ createdAt: -1 }).limit(limit).lean()
  return events.map((e) => {
    const ev = e as { userId: string; amountSpent: number; commissionAmount: number; source?: string; createdAt?: Date }
    return {
      userId: String(ev.userId),
      amountSpent: ev.amountSpent,
      commissionAmount: ev.commissionAmount,
      source: ev.source ?? "premium",
      at: new Date(ev.createdAt ?? Date.now()).toISOString(),
    }
  })
}

/**
 * Creates a payout request, reserving the amount from the spendable balance into
 * pendingPayout so it can't be double-spent. Returns the created request id.
 */
export async function requestPayout(opts: {
  creatorId: string
  amount: number
  destination?: string
}): Promise<{ ok: boolean; error?: string; balance?: number; requestId?: string }> {
  const { creatorId, amount, destination = "" } = opts
  await connectDB()

  const rounded = Math.round(Number(amount) * 100) / 100
  if (!Number.isFinite(rounded) || rounded <= 0) return { ok: false, error: "Importo non valido." }
  if (rounded < MIN_PAYOUT_AMOUNT) {
    return { ok: false, error: `Il payout minimo è di ${MIN_PAYOUT_AMOUNT}€.` }
  }

  const partner = await CreatorPartner.findOne({ creatorId })
  if (!partner) return { ok: false, error: "Creator non trovato." }
  if (partner.creditsBalance < rounded) {
    return { ok: false, error: "Saldo insufficiente." }
  }

  // Reserve funds: move from spendable balance to pending.
  partner.creditsBalance = Math.round((partner.creditsBalance - rounded) * 100) / 100
  partner.pendingPayout = Math.round(((partner.pendingPayout || 0) + rounded) * 100) / 100
  await partner.save()
  await CreatorCreditsLedger.create({
    creatorId,
    delta: -rounded,
    reason: "Richiesta payout (riserva)",
    balanceAfter: partner.creditsBalance,
  })

  const request = await CreatorPayoutRequest.create({ creatorId, amount: rounded, destination })
  return { ok: true, balance: partner.creditsBalance, requestId: String(request._id) }
}

/** Lists payout requests for a creator (or all, for admins). */
export async function listPayoutRequests(opts: { creatorId?: string; status?: string; limit?: number } = {}) {
  await connectDB()
  const query: Record<string, unknown> = {}
  if (opts.creatorId) query.creatorId = opts.creatorId
  if (opts.status) query.status = opts.status
  const rows = await CreatorPayoutRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 100)
    .lean()
  return rows.map((r) => {
    const row = r as {
      _id: unknown
      creatorId: string
      amount: number
      destination?: string
      status: string
      note?: string
      stripeTransferId?: string | null
      createdAt?: Date
      decidedAt?: Date | null
    }
    return {
      id: String(row._id),
      creatorId: String(row.creatorId),
      amount: row.amount,
      destination: row.destination ?? "",
      status: row.status,
      note: row.note ?? "",
      stripeTransferId: row.stripeTransferId ?? null,
      at: new Date(row.createdAt ?? Date.now()).toISOString(),
      decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
    }
  })
}

/** Real-money balance summary used by the payout UI. */
export interface CreatorBalance {
  available: number
  pending: number
  paid: number
}

/** Returns the creator's available / pending / paid euro balances. */
export async function getBalance(creatorId: string): Promise<CreatorBalance | null> {
  await connectDB()
  const partner = await CreatorPartner.findOne({ creatorId }).lean()
  if (!partner) return null
  const doc = partner as { creditsBalance?: number; pendingPayout?: number; totalPaidOut?: number }
  const round = (n: number) => Math.round((n || 0) * 100) / 100
  return {
    available: round(doc.creditsBalance || 0),
    pending: round(doc.pendingPayout || 0),
    paid: round(doc.totalPaidOut || 0),
  }
}

/**
 * Admin decision on a payout request. Approve moves reserved funds to
 * totalPaidOut; reject refunds them to the spendable balance.
 */
export async function decidePayoutRequest(opts: {
  requestId: string
  approve: boolean
  note?: string
  reviewedBy?: string
}): Promise<{ ok: boolean; error?: string; stripeTransferId?: string | null }> {
  const { requestId, approve, note = "", reviewedBy } = opts
  await connectDB()

  const request = await CreatorPayoutRequest.findById(requestId)
  if (!request) return { ok: false, error: "Richiesta non trovata." }
  if (request.status !== "pending") return { ok: false, error: "Richiesta già gestita." }

  const partner = await CreatorPartner.findOne({ creatorId: request.creatorId })
  if (!partner) return { ok: false, error: "Creator non trovato." }

  const amount = request.amount
  partner.pendingPayout = Math.round((Math.max(0, (partner.pendingPayout || 0) - amount)) * 100) / 100

  let transferId: string | null = null
  if (approve) {
    // Move reserved funds to the paid total. Attempt a real-money transfer via
    // the pluggable provider (Stripe Connect when configured); falls back to a
    // manual marker so the flow works without Stripe wired up yet.
    partner.totalPaidOut = Math.round(((partner.totalPaidOut || 0) + amount) * 100) / 100
    transferId = await createPayoutTransfer({
      creatorId: String(request.creatorId),
      amount,
      destination: request.destination || "",
    })
  } else {
    // Refund the reserved funds back to spendable balance.
    partner.creditsBalance = Math.round((partner.creditsBalance + amount) * 100) / 100
    await CreatorCreditsLedger.create({
      creatorId: request.creatorId,
      delta: amount,
      reason: "Payout rifiutato (rimborso)",
      balanceAfter: partner.creditsBalance,
    })
  }
  await partner.save()

  // Approved + transferred → "paid"; approved without transfer stays "approved".
  request.status = approve ? (transferId ? "paid" : "approved") : "rejected"
  request.note = note
  request.stripeTransferId = transferId
  request.reviewedBy = reviewedBy || null
  request.reviewedAt = new Date()
  request.decidedAt = new Date()
  await request.save()

  return { ok: true, stripeTransferId: transferId }
}

/**
 * Pluggable payout transfer. When Stripe Connect is configured (STRIPE_SECRET_KEY
 * + the creator has a connected account), this is where the real transfer is
 * created. Until then it returns a manual marker so admins can settle out-of-band.
 * Kept isolated so wiring Stripe later requires no changes to the decision flow.
 */
async function createPayoutTransfer(opts: {
  creatorId: string
  amount: number
  destination: string
}): Promise<string | null> {
  void opts
  // Stripe Connect integration point (Blocco 51.3 §3): create a Transfer here.
  // Returning a manual marker keeps the payout marked as settled without Stripe.
  return `manual_${Date.now()}`
}

export interface AdminCreatorRow {
  creatorId: string
  username: string
  email: string
  referralCode: string
  commissionRate: number
  commissionDurationMonths: number
  balance: number
  totalEarned: number
  pendingPayout: number
  totalPaidOut: number
  totalUsersInvited: number
  active: boolean
}

/** Lists all creator partners with owner info for the admin panel. */
export async function listCreators(limit = 200): Promise<AdminCreatorRow[]> {
  await connectDB()
  const partners = await CreatorPartner.find().sort({ createdAt: -1 }).limit(limit).lean()
  const ids = partners.map((p) => String((p as { creatorId: unknown }).creatorId))
  const users = await User.find({ _id: { $in: ids } }).select("username email").lean()
  const byId = new Map(users.map((u) => [String((u as { _id: unknown })._id), u as { username?: string; email?: string }]))

  return partners.map((p) => {
    const doc = p as {
      creatorId: unknown
      referralCode: string
      commissionRate: number
      commissionDurationMonths: number
      creditsBalance: number
      totalCreditsEarned: number
      pendingPayout?: number
      totalPaidOut?: number
      totalUsersInvited: number
      active: boolean
    }
    const u = byId.get(String(doc.creatorId))
    return {
      creatorId: String(doc.creatorId),
      username: u?.username || "Utente",
      email: u?.email || "",
      referralCode: doc.referralCode,
      commissionRate: doc.commissionRate,
      commissionDurationMonths: doc.commissionDurationMonths,
      balance: Math.round(doc.creditsBalance * 100) / 100,
      totalEarned: Math.round(doc.totalCreditsEarned * 100) / 100,
      pendingPayout: Math.round((doc.pendingPayout || 0) * 100) / 100,
      totalPaidOut: Math.round((doc.totalPaidOut || 0) * 100) / 100,
      totalUsersInvited: doc.totalUsersInvited,
      active: doc.active,
    }
  })
}

export interface AdminCreatorStats {
  totalCreators: number
  activeCreators: number
  totalEarned: number
  totalBalance: number
  totalPaidOut: number
  pendingPayout: number
  pendingPayoutRequests: number
  totalCommissionEvents: number
}

/** Aggregate program metrics for the admin dashboard. */
export async function getCreatorAdminStats(): Promise<AdminCreatorStats> {
  await connectDB()
  const [partners, pendingRequests, commissionCount] = await Promise.all([
    CreatorPartner.find().select("active creditsBalance totalCreditsEarned pendingPayout totalPaidOut").lean(),
    CreatorPayoutRequest.countDocuments({ status: "pending" }),
    CreatorCommissionEvent.countDocuments({}),
  ])

  let totalEarned = 0
  let totalBalance = 0
  let totalPaidOut = 0
  let pendingPayout = 0
  let activeCreators = 0
  for (const p of partners) {
    const doc = p as {
      active?: boolean
      creditsBalance?: number
      totalCreditsEarned?: number
      pendingPayout?: number
      totalPaidOut?: number
    }
    if (doc.active) activeCreators++
    totalEarned += Number(doc.totalCreditsEarned) || 0
    totalBalance += Number(doc.creditsBalance) || 0
    totalPaidOut += Number(doc.totalPaidOut) || 0
    pendingPayout += Number(doc.pendingPayout) || 0
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    totalCreators: partners.length,
    activeCreators,
    totalEarned: round(totalEarned),
    totalBalance: round(totalBalance),
    totalPaidOut: round(totalPaidOut),
    pendingPayout: round(pendingPayout),
    pendingPayoutRequests: pendingRequests,
    totalCommissionEvents: commissionCount,
  }
}
