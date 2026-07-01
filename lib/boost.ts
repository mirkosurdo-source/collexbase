import { connectDB } from "@/lib/db"
import BoostActivation, {
  type BoostTargetType,
  type BoostTier,
  BOOST_TARGET_TYPES,
  BOOST_TIERS,
} from "@/lib/models/BoostActivation"
import { getOrCreateSubState, type PlanId } from "@/lib/subscription"
import { recordTransaction, getOrCreateBalance } from "@/lib/collexcoin"

/* -------------------------------------------------------------------------- */
/* Pricing (CollexCoins) — accessible tier (Blocco 33, section 2)             */
/* -------------------------------------------------------------------------- */

/** List price in CollexCoins by target type and tier (before tier discount). */
export const BOOST_PRICES: Record<BoostTargetType, Record<BoostTier, number>> = {
  marketplace: { base: 40, plus: 80, ultra: 150 },
  auction: { base: 30, plus: 80, ultra: 120 },
  trade: { base: 20, plus: 60, ultra: 100 },
  showcase: { base: 35, plus: 70, ultra: 180 },
}

/**
 * Automatic subscription discount on every boost (Blocco 33, section 3):
 * Premium -15%, Gold -10%, Base none.
 */
export const BOOST_TIER_DISCOUNT: Record<PlanId, number> = {
  Base: 0,
  Gold: 0.1,
  Premium: 0.15,
}

/* -------------------------------------------------------------------------- */
/* Effects (Blocco 33, section 4)                                             */
/* -------------------------------------------------------------------------- */

export interface BoostEffect {
  tier: BoostTier
  label: string
  /** Extra visibility, e.g. 50 for +50%. */
  visibilityPct: number
  /** Active duration in hours. */
  durationHours: number
  /** Ranking weight used to sort boosted items to the top. */
  rankWeight: number
  /** Whether the Ultra premium CollexSpark callout applies. */
  callout: boolean
}

export const BOOST_EFFECTS: Record<BoostTier, BoostEffect> = {
  base: { tier: "base", label: "Boost", visibilityPct: 50, durationHours: 24, rankWeight: 1, callout: false },
  plus: { tier: "plus", label: "Boost Plus", visibilityPct: 150, durationHours: 72, rankWeight: 2, callout: false },
  ultra: { tier: "ultra", label: "Boost Ultra", visibilityPct: 300, durationHours: 24 * 7, rankWeight: 3, callout: true },
}

export function isBoostTargetType(v: unknown): v is BoostTargetType {
  return typeof v === "string" && (BOOST_TARGET_TYPES as readonly string[]).includes(v)
}

export function isBoostTier(v: unknown): v is BoostTier {
  return typeof v === "string" && (BOOST_TIERS as readonly string[]).includes(v)
}

/* -------------------------------------------------------------------------- */
/* Price calculation                                                          */
/* -------------------------------------------------------------------------- */

export interface BoostQuote {
  targetType: BoostTargetType
  tier: BoostTier
  plan: PlanId
  listPrice: number
  discountPct: number
  /** Coins actually charged (rounded to nearest coin). */
  finalPrice: number
  savings: number
  effect: BoostEffect
}

/** Computes the boost price for a target/tier given the buyer's subscription. */
export function quoteBoost(targetType: BoostTargetType, tier: BoostTier, plan: PlanId): BoostQuote {
  const listPrice = BOOST_PRICES[targetType][tier]
  const discount = BOOST_TIER_DISCOUNT[plan] ?? 0
  const finalPrice = Math.round(listPrice * (1 - discount))
  return {
    targetType,
    tier,
    plan,
    listPrice,
    discountPct: Math.round(discount * 100),
    finalPrice,
    savings: listPrice - finalPrice,
    effect: BOOST_EFFECTS[tier],
  }
}

/** All tier quotes for a target type (used by the boost dialog). */
export function quoteAllTiers(targetType: BoostTargetType, plan: PlanId): BoostQuote[] {
  return BOOST_TIERS.map((t) => quoteBoost(targetType, t, plan))
}

/* -------------------------------------------------------------------------- */
/* DTOs                                                                        */
/* -------------------------------------------------------------------------- */

export interface BoostDTO {
  id: string
  targetType: BoostTargetType
  targetId: string
  tier: BoostTier
  label: string
  coinsSpent: number
  visibilityPct: number
  rankWeight: number
  callout: boolean
  startsAt: string
  endsAt: string
  /** Milliseconds until expiry; negative when expired. */
  remainingMs: number
}

function toDTO(b: Record<string, unknown>): BoostDTO {
  const tier = String(b.tier) as BoostTier
  const effect = BOOST_EFFECTS[tier] ?? BOOST_EFFECTS.base
  const endsAt = new Date(b.endsAt as string)
  return {
    id: String(b._id),
    targetType: String(b.targetType) as BoostTargetType,
    targetId: String(b.targetId),
    tier,
    label: effect.label,
    coinsSpent: Number(b.coinsSpent || 0),
    visibilityPct: Number(b.visibilityPct || effect.visibilityPct),
    rankWeight: effect.rankWeight,
    callout: effect.callout,
    startsAt: new Date(b.startsAt as string).toISOString(),
    endsAt: endsAt.toISOString(),
    remainingMs: endsAt.getTime() - Date.now(),
  }
}

/* -------------------------------------------------------------------------- */
/* Activation                                                                  */
/* -------------------------------------------------------------------------- */

export interface ActivateResult {
  ok: boolean
  error?: string
  boost?: BoostDTO
  balance?: number
  quote?: BoostQuote
}

/**
 * Activates a boost: prices it for the buyer's tier, verifies the CollexCoin
 * balance, debits via the existing ledger primitive (type "spend" — no ledger
 * change), and records the BoostActivation. Re-boosting an already-boosted
 * target extends/upgrades by creating a fresh activation (latest wins).
 */
export async function activateBoost(opts: {
  userId: string
  targetType: BoostTargetType
  targetId: string
  tier: BoostTier
}): Promise<ActivateResult> {
  const { userId, targetType, targetId, tier } = opts
  await connectDB()

  const state = await getOrCreateSubState(userId)
  const plan = state.plan as PlanId
  const quote = quoteBoost(targetType, tier, plan)

  // Read-only balance check before charging.
  const balance = await getOrCreateBalance(userId)
  if (balance.balance < quote.finalPrice) {
    return { ok: false, error: "Saldo CollexCoins insufficiente.", balance: balance.balance, quote }
  }

  // Debit using the existing ledger's "spend" type (ledger untouched).
  const tx = await recordTransaction({
    userId,
    amount: -quote.finalPrice,
    type: "spend",
    description: `Boost ${quote.effect.label} · ${targetType}`,
  })
  if (!tx.ok) {
    return { ok: false, error: tx.error || "Pagamento non riuscito.", balance: tx.balance, quote }
  }

  const effect = quote.effect
  const now = Date.now()
  const doc = await BoostActivation.create({
    userId,
    targetType,
    targetId,
    tier,
    coinsSpent: quote.finalPrice,
    visibilityPct: effect.visibilityPct,
    startsAt: new Date(now),
    endsAt: new Date(now + effect.durationHours * 60 * 60 * 1000),
  })

  return { ok: true, boost: toDTO(doc.toObject()), balance: tx.balance, quote }
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Active (non-expired, non-disabled) boosts for a user, newest first. */
export async function getActiveBoosts(userId: string): Promise<BoostDTO[]> {
  await connectDB()
  const docs = await BoostActivation.find({
    userId,
    disabled: { $ne: true },
    endsAt: { $gt: new Date() },
  })
    .sort({ endsAt: -1 })
    .lean()
  return (docs as Record<string, unknown>[]).map(toDTO)
}

/** Full boost history for a user (active + expired), newest first. */
export async function getBoostHistory(userId: string, limit = 50): Promise<BoostDTO[]> {
  await connectDB()
  const docs = await BoostActivation.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean()
  return (docs as Record<string, unknown>[]).map(toDTO)
}

/** The single active boost for a target, or null. */
export async function getBoostForTarget(
  targetType: BoostTargetType,
  targetId: string,
): Promise<BoostDTO | null> {
  await connectDB()
  const doc = await BoostActivation.findOne({
    targetType,
    targetId: String(targetId),
    disabled: { $ne: true },
    endsAt: { $gt: new Date() },
  })
    .sort({ endsAt: -1 })
    .lean()
  return doc ? toDTO(doc as Record<string, unknown>) : null
}

/**
 * Map of active boosts keyed by targetId for a batch of targets. Used to
 * decorate listing pages without per-row queries. When several boosts exist for
 * one target the strongest (highest rankWeight, then latest expiry) wins.
 */
export async function getBoostsForTargets(
  targetType: BoostTargetType,
  targetIds: string[],
): Promise<Record<string, BoostDTO>> {
  await connectDB()
  if (!targetIds.length) return {}
  const docs = await BoostActivation.find({
    targetType,
    targetId: { $in: targetIds.map(String) },
    disabled: { $ne: true },
    endsAt: { $gt: new Date() },
  })
    .sort({ endsAt: -1 })
    .lean()

  const map: Record<string, BoostDTO> = {}
  for (const raw of docs as Record<string, unknown>[]) {
    const dto = toDTO(raw)
    const existing = map[dto.targetId]
    if (!existing || dto.rankWeight > existing.rankWeight) {
      map[dto.targetId] = dto
    }
  }
  return map
}

/**
 * Returns the target IDs with an active boost of a given type, ordered by rank
 * weight (highest first). Used to surface "in evidenza" rails (e.g. featured
 * showcases) without coupling the engines to the boost module.
 */
export async function getActiveBoostTargetIds(targetType: BoostTargetType, limit = 12): Promise<string[]> {
  await connectDB()
  const docs = await BoostActivation.find({
    targetType,
    disabled: { $ne: true },
    endsAt: { $gt: new Date() },
  })
    .sort({ rankWeight: -1, endsAt: -1 })
    .limit(limit)
    .select("targetId")
    .lean()
  // De-dupe while preserving rank order.
  const seen = new Set<string>()
  const ids: string[] = []
  for (const d of docs as Record<string, unknown>[]) {
    const id = String(d.targetId)
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

/* -------------------------------------------------------------------------- */
/* Badge metrics (Blocco 33, section 7)                                        */
/* -------------------------------------------------------------------------- */

export interface BoostBadgeMetrics {
  boostMarketplaceCount: number
  boostAuctionCount: number
  boostTradeCount: number
  boostShowcaseCount: number
}

/** Lifetime boost counts per target type for the badge engine. */
export async function gatherBoostBadgeMetrics(userId: string): Promise<BoostBadgeMetrics> {
  await connectDB()
  const rows = (await BoostActivation.aggregate([
    { $match: { userId: typeof userId === "string" ? toObjectIdSafe(userId) : userId } },
    { $group: { _id: "$targetType", count: { $sum: 1 } } },
  ])) as { _id: string; count: number }[]

  const byType: Record<string, number> = {}
  for (const r of rows) byType[r._id] = r.count

  return {
    boostMarketplaceCount: byType.marketplace || 0,
    boostAuctionCount: byType.auction || 0,
    boostTradeCount: byType.trade || 0,
    boostShowcaseCount: byType.showcase || 0,
  }
}

// Local ObjectId coercion to avoid importing mongoose at call sites.
function toObjectIdSafe(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Types } = require("mongoose")
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

/* -------------------------------------------------------------------------- */
/* Profile summary (Blocco 33, section 9)                                      */
/* -------------------------------------------------------------------------- */

export interface BoostProfileSummary {
  active: BoostDTO[]
  history: BoostDTO[]
  totalCoinsSpent: number
  counts: BoostBadgeMetrics
}

export async function getBoostProfileSummary(userId: string): Promise<BoostProfileSummary> {
  const [active, history, counts] = await Promise.all([
    getActiveBoosts(userId),
    getBoostHistory(userId, 20),
    gatherBoostBadgeMetrics(userId),
  ])
  const totalCoinsSpent = history.reduce((s, b) => s + b.coinsSpent, 0)
  return { active, history, totalCoinsSpent, counts }
}

/* -------------------------------------------------------------------------- */
/* Advisor — Strategia Boost (Blocco 33, section 8)                            */
/* -------------------------------------------------------------------------- */

export interface BoostSuggestion {
  targetType: BoostTargetType
  targetId: string
  title: string
  image: string
  /** 0–100 opportunity score. */
  score: number
  reason: string
  hot: boolean
  recommendedTier: BoostTier
  quote: BoostQuote
}

function pickTier(score: number): BoostTier {
  if (score >= 75) return "ultra"
  if (score >= 45) return "plus"
  return "base"
}

/**
 * Analyses the user's own active marketplace listings, auctions, trades and
 * showcase to suggest which are worth boosting. Pure read-only scoring derived
 * from existing engine signals (saves, views, bids, price). Already-boosted
 * targets are skipped.
 */
export async function getBoostSuggestions(userId: string, limit = 6): Promise<BoostSuggestion[]> {
  await connectDB()
  const plan = (await getOrCreateSubState(userId)).plan as PlanId
  const oid = toObjectIdSafe(userId)

  // Late imports keep the boost module decoupled from the engines.
  const Listing = (await import("@/lib/models/Listing")).default
  const Auction = (await import("@/lib/models/Auction")).default
  const Trade = (await import("@/lib/models/Trade")).default

  const [listings, auctions, trades] = await Promise.all([
    Listing.find({ sellerId: oid, status: "active" }).sort({ savedCount: -1 }).limit(12).lean(),
    Auction.find({ userId: String(userId), status: "active" }).sort({ createdAt: -1 }).limit(12).lean(),
    Trade.find({ fromUserId: String(userId), status: "pending" }).sort({ createdAt: -1 }).limit(12).lean(),
  ])

  const suggestions: BoostSuggestion[] = []

  for (const l of listings as Record<string, unknown>[]) {
    const saves = Number(l.savedCount || 0)
    const views = Number(l.viewsCount || 0)
    // High interest but no boost yet → strong candidate.
    const score = Math.min(100, saves * 12 + views * 2 + 20)
    const id = String(l._id)
    if (await getBoostForTarget("marketplace", id)) continue
    const tier = pickTier(score)
    suggestions.push({
      targetType: "marketplace",
      targetId: id,
      title: String(l.itemName || "Annuncio"),
      image: String(l.image || ""),
      score,
      reason: saves > 0 ? `${saves} salvataggi: alta probabilità di vendita.` : "Aumenta la visibilità per vendere prima.",
      hot: saves >= 3,
      recommendedTier: tier,
      quote: quoteBoost("marketplace", tier, plan),
    })
  }

  for (const a of auctions as Record<string, unknown>[]) {
    const bids = Array.isArray(a.bids) ? a.bids.length : 0
    const endsAt = a.endsAt ? new Date(a.endsAt as string).getTime() : 0
    const hoursLeft = endsAt ? (endsAt - Date.now()) / 3_600_000 : 999
    // Hot auction: bids coming in and time running out.
    const score = Math.min(100, bids * 15 + (hoursLeft < 48 ? 30 : 0) + 15)
    const id = String(a._id)
    if (await getBoostForTarget("auction", id)) continue
    const tier = pickTier(score)
    suggestions.push({
      targetType: "auction",
      targetId: id,
      title: String(a.itemName || "Asta"),
      image: String(a.image || ""),
      score,
      reason: bids > 0 ? `${bids} offerte attive: asta calda!` : "Spingi l'asta per attrarre offerte.",
      hot: bids >= 2 || hoursLeft < 24,
      recommendedTier: tier,
      quote: quoteBoost("auction", tier, plan),
    })
  }

  for (const t of trades as Record<string, unknown>[]) {
    const id = String(t._id)
    if (await getBoostForTarget("trade", id)) continue
    const score = 35
    const tier = pickTier(score)
    suggestions.push({
      targetType: "trade",
      targetId: id,
      title: String(t.offeredItemName || "Scambio"),
      image: String(t.offeredItemImage || ""),
      score,
      reason: "Aumenta le probabilità di trovare uno scambio.",
      hot: false,
      recommendedTier: tier,
      quote: quoteBoost("trade", tier, plan),
    })
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit)
}
