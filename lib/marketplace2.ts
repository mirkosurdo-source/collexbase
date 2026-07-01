/**
 * Blocco 47 — Marketplace 2.0 engine.
 *
 * Price history, price alerts and automatic offers. Fully additive: it appends
 * to its own collections and layers on top of the existing Offer/Listing flow
 * without mutating base marketplace behaviour.
 */
import { connectDB } from "@/lib/db"
import PriceHistory from "@/lib/models/PriceHistory"
import PriceAlert from "@/lib/models/PriceAlert"
import AutoOffer from "@/lib/models/AutoOffer"
import Listing from "@/lib/models/Listing"
import Offer from "@/lib/models/Offer"
import { createNotification } from "@/lib/notifications"
import { evaluateFairness } from "@/lib/ai-advisor"

// --- Anti-abuse limits -----------------------------------------------------
export const MAX_ALERTS_PER_USER = 20
export const MAX_AUTO_OFFERS_PER_USER = 10
export const ALERT_RETRIGGER_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6h

export type PriceSource = "marketplace" | "seller_pro" | "tcgplayer" | "cardmarket" | "ebay"

/** Normalizes an item name into a stable card key for grouping price points. */
export function cardKeyForName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

// --- Price history ---------------------------------------------------------

/**
 * Records a sale/observation and evaluates any alerts watching this card.
 * Fire-and-forget safe: callers may ignore the promise.
 */
export async function recordSale(opts: {
  name: string
  category?: string
  price: number
  source?: PriceSource
  date?: Date
}): Promise<void> {
  const price = Number(opts.price)
  if (!opts.name || !Number.isFinite(price) || price <= 0) return
  await connectDB()
  const cardId = cardKeyForName(opts.name)
  if (!cardId) return

  await PriceHistory.create({
    cardId,
    label: opts.name,
    category: opts.category || "",
    price: Math.round(price * 100) / 100,
    source: opts.source || "marketplace",
    date: opts.date || new Date(),
  })

  await evaluateAlertsForCard(cardId, price).catch(() => {})
}

export interface PriceSeriesPoint {
  date: string
  price: number
}

export interface PriceHistoryResult {
  cardId: string
  label: string
  range: number
  series: PriceSeriesPoint[]
  stats: {
    min: number
    max: number
    avg: number
    volume: number
    first: number
    last: number
    changePct: number
  }
  movingAvg7: PriceSeriesPoint[]
  movingAvg30: PriceSeriesPoint[]
}

function movingAverage(series: PriceSeriesPoint[], window: number): PriceSeriesPoint[] {
  if (series.length === 0) return []
  const out: PriceSeriesPoint[] = []
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - window + 1)
    const slice = series.slice(start, i + 1)
    const avg = slice.reduce((s, p) => s + p.price, 0) / slice.length
    out.push({ date: series[i].date, price: Math.round(avg * 100) / 100 })
  }
  return out
}

/** Returns the price series + summary stats for a card over the last `rangeDays`. */
export async function getPriceHistory(cardId: string, rangeDays = 30): Promise<PriceHistoryResult> {
  await connectDB()
  const key = cardKeyForName(cardId) === cardId ? cardId : cardKeyForName(cardId)
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)

  const docs = (await PriceHistory.find({ cardId: key, date: { $gte: since } })
    .sort({ date: 1 })
    .lean()) as Array<{ price: number; date: Date; label?: string }>

  const series: PriceSeriesPoint[] = docs.map((d) => ({
    date: new Date(d.date).toISOString().slice(0, 10),
    price: Math.round(d.price * 100) / 100,
  }))

  const prices = series.map((s) => s.price)
  const volume = prices.length
  const min = volume ? Math.min(...prices) : 0
  const max = volume ? Math.max(...prices) : 0
  const avg = volume ? Math.round((prices.reduce((s, p) => s + p, 0) / volume) * 100) / 100 : 0
  const first = volume ? prices[0] : 0
  const last = volume ? prices[volume - 1] : 0
  const changePct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0

  return {
    cardId: key,
    label: docs[docs.length - 1]?.label || cardId,
    range: rangeDays,
    series,
    stats: { min, max, avg, volume, first, last, changePct },
    movingAvg7: movingAverage(series, 7),
    movingAvg30: movingAverage(series, 30),
  }
}

// --- Price alerts ----------------------------------------------------------

export async function createAlert(opts: {
  userId: string
  cardId: string
  label?: string
  targetPrice: number
  direction: "above" | "below" | "reaches" | "swing"
}): Promise<{ ok: boolean; message: string; alert?: unknown }> {
  await connectDB()
  const key = cardKeyForName(opts.cardId)
  if (!key) return { ok: false, message: "Carta non valida." }

  const active = await PriceAlert.countDocuments({ userId: opts.userId, active: true })
  if (active >= MAX_ALERTS_PER_USER) {
    return { ok: false, message: `Limite di ${MAX_ALERTS_PER_USER} alert raggiunto.` }
  }
  if (opts.direction !== "swing" && (!Number.isFinite(opts.targetPrice) || opts.targetPrice <= 0)) {
    return { ok: false, message: "Prezzo target non valido." }
  }

  // Avoid duplicate identical alerts.
  const dup = await PriceAlert.findOne({
    userId: opts.userId,
    cardId: key,
    direction: opts.direction,
    targetPrice: opts.targetPrice,
    active: true,
  })
  if (dup) return { ok: false, message: "Hai già un alert identico." }

  const alert = await PriceAlert.create({
    userId: opts.userId,
    cardId: key,
    label: opts.label || opts.cardId,
    targetPrice: Math.round((Number(opts.targetPrice) || 0) * 100) / 100,
    direction: opts.direction,
    active: true,
  })
  return { ok: true, message: "Alert creato.", alert }
}

export async function listAlerts(userId: string) {
  await connectDB()
  return PriceAlert.find({ userId }).sort({ createdAt: -1 }).lean()
}

export async function deleteAlert(userId: string, alertId: string): Promise<boolean> {
  await connectDB()
  const res = await PriceAlert.deleteOne({ _id: alertId, userId })
  return res.deletedCount > 0
}

/**
 * Evaluates active alerts for a card against the latest price and fires
 * notifications. De-duplicated by a per-alert cooldown.
 */
export async function evaluateAlertsForCard(cardId: string, latestPrice: number): Promise<void> {
  await connectDB()
  const key = cardKeyForName(cardId) === cardId ? cardId : cardKeyForName(cardId)
  const alerts = await PriceAlert.find({ cardId: key, active: true })
  if (alerts.length === 0) return

  // 24h swing reference: earliest price in the last 24h.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const prior = (await PriceHistory.find({ cardId: key, date: { $gte: dayAgo } })
    .sort({ date: 1 })
    .limit(1)
    .lean()) as Array<{ price: number }>
  const ref = prior[0]?.price ?? latestPrice
  const swingPct = ref > 0 ? ((latestPrice - ref) / ref) * 100 : 0

  const now = Date.now()
  for (const alert of alerts) {
    if (alert.lastTriggeredAt && now - new Date(alert.lastTriggeredAt).getTime() < ALERT_RETRIGGER_COOLDOWN_MS) {
      continue
    }
    let hit = false
    let reason = ""
    const t = alert.targetPrice
    switch (alert.direction) {
      case "above":
        hit = latestPrice > t
        reason = `è salito sopra ${t.toFixed(2)} €`
        break
      case "below":
        hit = latestPrice < t
        reason = `è sceso sotto ${t.toFixed(2)} €`
        break
      case "reaches":
        hit = Math.abs(latestPrice - t) <= Math.max(0.5, t * 0.02)
        reason = `ha raggiunto ${t.toFixed(2)} €`
        break
      case "swing":
        hit = Math.abs(swingPct) >= 10
        reason = `ha avuto una variazione del ${swingPct.toFixed(1)}% nelle ultime 24h`
        break
    }
    if (!hit) continue

    alert.lastTriggeredAt = new Date()
    alert.lastTriggeredPrice = latestPrice
    alert.triggerCount = (alert.triggerCount || 0) + 1
    await alert.save()

    await createNotification({
      userId: String(alert.userId),
      type: "marketplace",
      title: "Alert prezzo",
      body: `"${alert.label}" ${reason}. Prezzo attuale: ${latestPrice.toFixed(2)} €.`,
      link: "/market/alerts",
    }).catch(() => {})
  }
}

// --- Automatic offers ------------------------------------------------------

export async function createAutoOffer(opts: {
  userId: string
  listingId: string
  maxPrice: number
}): Promise<{ ok: boolean; message: string; autoOffer?: unknown }> {
  await connectDB()
  const listing = await Listing.findById(opts.listingId)
  if (!listing || listing.status !== "active") {
    return { ok: false, message: "Annuncio non disponibile." }
  }
  if (String(listing.sellerId) === opts.userId) {
    return { ok: false, message: "Non puoi creare auto-offerte sui tuoi annunci." }
  }
  const maxPrice = Number(opts.maxPrice)
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    return { ok: false, message: "Prezzo massimo non valido." }
  }

  const active = await AutoOffer.countDocuments({ userId: opts.userId, active: true })
  if (active >= MAX_AUTO_OFFERS_PER_USER) {
    return { ok: false, message: `Limite di ${MAX_AUTO_OFFERS_PER_USER} auto-offerte raggiunto.` }
  }

  const existing = await AutoOffer.findOne({ userId: opts.userId, listingId: opts.listingId })
  if (existing && existing.active) {
    return { ok: false, message: "Hai già un'auto-offerta attiva su questo annuncio." }
  }

  // Step ~5% of max price, clamped to a sensible range.
  const step = Math.max(1, Math.round(maxPrice * 0.05))
  // Seed the first offer immediately at ~70% of the cap (never above it).
  const firstOffer = Math.min(maxPrice, Math.max(step, Math.round(maxPrice * 0.7)))

  const doc = existing || new AutoOffer({ userId: opts.userId, listingId: opts.listingId })
  doc.listingName = listing.itemName
  doc.sellerId = listing.sellerId
  doc.maxPrice = Math.round(maxPrice * 100) / 100
  doc.step = step
  doc.active = true
  doc.closedReason = ""
  doc.lastOffer = 0
  doc.offersSent = 0
  await doc.save()

  await placeAutoOffer(doc, firstOffer)

  return { ok: true, message: "Auto-offerta attivata.", autoOffer: doc }
}

export async function cancelAutoOffer(userId: string, autoOfferId: string): Promise<boolean> {
  await connectDB()
  const doc = await AutoOffer.findOne({ _id: autoOfferId, userId })
  if (!doc) return false
  doc.active = false
  doc.closedReason = "cancelled"
  await doc.save()
  return true
}

export async function listAutoOffers(userId: string) {
  await connectDB()
  return AutoOffer.find({ userId }).sort({ createdAt: -1 }).lean()
}

/** Creates a real Offer document for an auto-offer at the given amount. */
async function placeAutoOffer(doc: InstanceType<typeof AutoOffer>, amount: number): Promise<void> {
  const listing = await Listing.findById(doc.listingId)
  if (!listing || listing.status !== "active") {
    doc.active = false
    doc.closedReason = "cap"
    await doc.save()
    return
  }
  const fairness = evaluateFairness({ askValue: listing.price, offerValue: amount })
  await Offer.create({
    listingId: doc.listingId,
    listingName: listing.itemName,
    sellerId: listing.sellerId,
    buyerId: doc.userId,
    buyerUsername: "auto-offerta",
    type: "offer",
    amount: Math.round(amount * 100) / 100,
    coins: 0,
    offeredItems: [],
    offerValue: Math.round(amount * 100) / 100,
    fairnessScore: fairness.score,
    fairnessVerdict: fairness.verdict,
    message: "Offerta automatica",
    status: "pending",
    fromSeller: false,
  })
  doc.lastOffer = Math.round(amount * 100) / 100
  doc.offersSent = (doc.offersSent || 0) + 1
  await doc.save()

  await createNotification({
    userId: String(listing.sellerId),
    type: "trade",
    title: "Nuova offerta automatica",
    body: `Offerta automatica di ${amount.toFixed(2)} € su "${listing.itemName}".`,
    link: "/market/offers",
  }).catch(() => {})
}

/**
 * Called after an offer is rejected: if the buyer has an active auto-offer on
 * that listing, re-offer a higher amount up to the cap. Stops at the cap.
 */
export async function processAutoOfferAfterReject(offer: {
  listingId: string
  buyerId: string
}): Promise<void> {
  await connectDB()
  const doc = await AutoOffer.findOne({
    userId: offer.buyerId,
    listingId: offer.listingId,
    active: true,
  })
  if (!doc) return

  const next = Math.min(doc.maxPrice, (doc.lastOffer || 0) + doc.step)
  // Already at (or above) the cap: stop bidding.
  if (next <= doc.lastOffer || doc.lastOffer >= doc.maxPrice) {
    doc.active = false
    doc.closedReason = "cap"
    await doc.save()
    await createNotification({
      userId: String(doc.userId),
      type: "marketplace",
      title: "Auto-offerta conclusa",
      body: `L'auto-offerta per "${doc.listingName}" ha raggiunto il limite di ${doc.maxPrice.toFixed(2)} €.`,
      link: "/market/alerts",
    }).catch(() => {})
    return
  }
  await placeAutoOffer(doc, next)
}

/** Called when an auto-offer-backed offer is accepted: close the auto-offer. */
export async function closeAutoOfferOnAccept(buyerId: string, listingId: string): Promise<void> {
  await connectDB()
  await AutoOffer.updateMany(
    { userId: buyerId, listingId, active: true },
    { active: false, closedReason: "accepted" },
  )
}
