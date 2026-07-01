/**
 * Blocco 41 — Marketplace Pro engine.
 *
 * Pure-additive professional-seller logic: activation, Stripe Connect payouts,
 * inventory with marketplace mirroring, orders, commissions and ratings. None
 * of the base marketplace / escrow / payment flows are modified.
 */
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import SellerProfile from "@/lib/models/SellerProfile"
import SellerInventoryItem from "@/lib/models/SellerInventoryItem"
import SellerOrder from "@/lib/models/SellerOrder"
import Listing from "@/lib/models/Listing"
import User from "@/lib/models/User"
import { getStripe, isStripeConfigured } from "@/lib/stripe"
import { recordSale } from "@/lib/marketplace2"
import { computeSellerRanking } from "@/lib/seller-ranking"

// --- Anti-abuse limits (Blocco 41 §11) ---------------------------------------
export const MAX_INVENTORY_ITEMS = 1000
export const MAX_EDITS_PER_DAY = 50
export const DEFAULT_COMMISSION_RATE = 0.05
/** A price more than this multiple of the AI/median reference is flagged. */
export const PRICE_ANOMALY_MULTIPLE = 50
export const MAX_ITEM_PRICE = 1_000_000

function toObjectId(id: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// --- Profile -----------------------------------------------------------------

export async function getSellerProfile(userId: string) {
  await connectDB()
  return SellerProfile.findOne({ userId: toObjectId(userId) })
}

/** Returns the profile only if the seller is active, else null. */
export async function getActiveSellerProfile(userId: string) {
  const profile = await getSellerProfile(userId)
  if (!profile || !profile.active) return null
  return profile
}

/** Admin: activate a professional seller (creates profile + Connect account). */
export async function activateSeller(opts: {
  userId: string
  commissionRate?: number
}): Promise<{ ok: boolean; error?: string; profile?: InstanceType<typeof SellerProfile> }> {
  await connectDB()
  const user = await User.findById(opts.userId).select("username")
  if (!user) return { ok: false, error: "Utente non trovato." }

  const rate =
    typeof opts.commissionRate === "number" ? clampRate(opts.commissionRate) : DEFAULT_COMMISSION_RATE

  let profile = await SellerProfile.findOne({ userId: user._id })
  if (profile) {
    profile.active = true
    profile.deactivatedAt = null
    if (typeof opts.commissionRate === "number") profile.commissionRate = rate
    await profile.save()
  } else {
    profile = await SellerProfile.create({
      userId: user._id,
      username: user.username || "",
      active: true,
      commissionRate: rate,
    })
  }

  // Best-effort Connect account creation (non-fatal when Stripe absent).
  try {
    await ensureConnectAccount(String(user._id))
    profile = (await SellerProfile.findById(profile._id)) as InstanceType<typeof SellerProfile>
  } catch {
    // Stripe not configured yet — onboarding can be completed later.
  }

  return { ok: true, profile }
}

export async function deactivateSeller(userId: string) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(userId) })
  if (!profile) return { ok: false, error: "Profilo venditore non trovato." }
  profile.active = false
  profile.deactivatedAt = new Date()
  await profile.save()
  // Unpublish all mirrored listings so the marketplace stays consistent.
  await unpublishAllForSeller(userId)
  return { ok: true, profile }
}

export async function setCommissionRate(userId: string, rate: number) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(userId) })
  if (!profile) return { ok: false, error: "Profilo venditore non trovato." }
  profile.commissionRate = clampRate(rate)
  await profile.save()
  return { ok: true, profile }
}

export async function resetStripeAccount(userId: string) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(userId) })
  if (!profile) return { ok: false, error: "Profilo venditore non trovato." }
  profile.stripeAccountId = null
  profile.stripeChargesEnabled = false
  profile.stripePayoutsEnabled = false
  profile.stripeDetailsSubmitted = false
  await profile.save()
  return { ok: true, profile }
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_COMMISSION_RATE
  return Math.min(0.5, Math.max(0, rate))
}

// --- Stripe Connect ----------------------------------------------------------

/** Ensures the seller has a Stripe Connect (Express) account; returns its id. */
export async function ensureConnectAccount(userId: string): Promise<string> {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(userId) })
  if (!profile) throw new Error("SELLER_PROFILE_MISSING")
  if (profile.stripeAccountId) return profile.stripeAccountId

  const stripe = getStripe() // throws STRIPE_NOT_CONFIGURED when absent
  const user = await User.findById(userId).select("email")
  const account = await stripe.accounts.create({
    type: "express",
    email: user?.email || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { collexUserId: String(userId) },
  })
  profile.stripeAccountId = account.id
  await profile.save()
  return account.id
}

/** Creates a Stripe onboarding link for the seller to submit their details. */
export async function createOnboardingLink(opts: {
  userId: string
  baseUrl: string
}): Promise<{ url: string }> {
  const accountId = await ensureConnectAccount(opts.userId)
  const stripe = getStripe()
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${opts.baseUrl}/seller?stripe=refresh`,
    return_url: `${opts.baseUrl}/seller?stripe=done`,
    type: "account_onboarding",
  })
  return { url: link.url }
}

/** Refreshes cached onboarding flags from Stripe. */
export async function refreshConnectStatus(userId: string) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(userId) })
  if (!profile || !profile.stripeAccountId) return profile
  if (!isStripeConfigured()) return profile
  try {
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(profile.stripeAccountId)
    profile.stripeChargesEnabled = Boolean(account.charges_enabled)
    profile.stripePayoutsEnabled = Boolean(account.payouts_enabled)
    profile.stripeDetailsSubmitted = Boolean(account.details_submitted)
    await profile.save()
  } catch {
    // Leave cached values untouched on transient errors.
  }
  return profile
}

// --- Inventory ---------------------------------------------------------------

export async function countEditsToday(userId: string): Promise<number> {
  await connectDB()
  return SellerInventoryItem.countDocuments({
    sellerId: toObjectId(userId),
    updatedAt: { $gte: startOfToday() },
  })
}

export interface InventoryInput {
  cardId?: string
  title: string
  description?: string
  category?: string
  condition?: string
  price: number
  quantity?: number
  images?: string[]
}

/** Validates inventory input against anti-abuse rules. */
export function validateInventoryInput(input: InventoryInput): { ok: boolean; error?: string } {
  const title = (input.title || "").trim()
  if (title.length < 2) return { ok: false, error: "Titolo troppo corto." }
  if (!Number.isFinite(input.price) || input.price < 0) return { ok: false, error: "Prezzo non valido." }
  if (input.price > MAX_ITEM_PRICE) return { ok: false, error: "Prezzo troppo elevato." }
  const qty = input.quantity ?? 1
  if (!Number.isInteger(qty) || qty < 0) return { ok: false, error: "Quantità non valida." }
  return { ok: true }
}

/** Detects a near-duplicate active item by normalized title for the same seller. */
export async function findDuplicateItem(userId: string, title: string, excludeId?: string) {
  await connectDB()
  const normalized = title.trim().toLowerCase()
  const candidates = await SellerInventoryItem.find({ sellerId: toObjectId(userId) }).select("title")
  return candidates.find(
    (c) => String(c._id) !== excludeId && (c.title || "").trim().toLowerCase() === normalized,
  )
}

export async function createInventoryItem(userId: string, input: InventoryInput) {
  await connectDB()
  const valid = validateInventoryInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }

  const total = await SellerInventoryItem.countDocuments({ sellerId: toObjectId(userId) })
  if (total >= MAX_INVENTORY_ITEMS) return { ok: false, error: "Limite di 1000 annunci raggiunto." }

  const edits = await countEditsToday(userId)
  if (edits >= MAX_EDITS_PER_DAY) return { ok: false, error: "Limite di 50 modifiche giornaliere raggiunto." }

  const dup = await findDuplicateItem(userId, input.title)
  if (dup) return { ok: false, error: "Esiste già un oggetto con questo titolo." }

  const item = await SellerInventoryItem.create({
    sellerId: toObjectId(userId),
    cardId: input.cardId || "",
    title: input.title.trim(),
    description: input.description || "",
    category: input.category || "",
    condition: input.condition || "",
    price: input.price,
    quantity: input.quantity ?? 1,
    images: Array.isArray(input.images) ? input.images.slice(0, 8) : [],
  })
  return { ok: true, item }
}

export async function updateInventoryItem(userId: string, itemId: string, input: Partial<InventoryInput>) {
  await connectDB()
  const item = await SellerInventoryItem.findOne({ _id: toObjectId(itemId), sellerId: toObjectId(userId) })
  if (!item) return { ok: false, error: "Oggetto non trovato." }

  const edits = await countEditsToday(userId)
  if (edits >= MAX_EDITS_PER_DAY) return { ok: false, error: "Limite di 50 modifiche giornaliere raggiunto." }

  if (typeof input.title === "string") {
    if (input.title.trim().length < 2) return { ok: false, error: "Titolo troppo corto." }
    const dup = await findDuplicateItem(userId, input.title, itemId)
    if (dup) return { ok: false, error: "Esiste già un oggetto con questo titolo." }
    item.title = input.title.trim()
  }
  if (typeof input.price === "number") {
    if (input.price < 0 || input.price > MAX_ITEM_PRICE) return { ok: false, error: "Prezzo non valido." }
    item.price = input.price
  }
  if (typeof input.quantity === "number") {
    if (!Number.isInteger(input.quantity) || input.quantity < 0)
      return { ok: false, error: "Quantità non valida." }
    item.quantity = input.quantity
  }
  if (typeof input.description === "string") item.description = input.description
  if (typeof input.category === "string") item.category = input.category
  if (typeof input.condition === "string") item.condition = input.condition
  if (typeof input.cardId === "string") item.cardId = input.cardId
  if (Array.isArray(input.images)) item.images = input.images.slice(0, 8)
  await item.save()

  // Keep the mirrored listing in sync when published.
  if (item.published && item.listingId) {
    await Listing.findByIdAndUpdate(item.listingId, {
      itemName: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      price: item.price,
      image: item.images[0] || "",
      photos: item.images,
      status: item.quantity > 0 ? "active" : "pending",
    })
  }
  return { ok: true, item }
}

export async function deleteInventoryItem(userId: string, itemId: string) {
  await connectDB()
  const item = await SellerInventoryItem.findOne({ _id: toObjectId(itemId), sellerId: toObjectId(userId) })
  if (!item) return { ok: false, error: "Oggetto non trovato." }
  if (item.listingId) await Listing.findByIdAndUpdate(item.listingId, { status: "cancelled" })
  await item.deleteOne()
  return { ok: true }
}

/** Publishes an inventory item by mirroring it into the base Listing collection. */
export async function setItemPublished(userId: string, itemId: string, published: boolean) {
  await connectDB()
  const item = await SellerInventoryItem.findOne({ _id: toObjectId(itemId), sellerId: toObjectId(userId) })
  if (!item) return { ok: false, error: "Oggetto non trovato." }

  if (published) {
    const user = await User.findById(userId).select("username")
    if (item.listingId) {
      await Listing.findByIdAndUpdate(item.listingId, {
        itemName: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        price: item.price,
        image: item.images[0] || "",
        photos: item.images,
        status: "active",
      })
    } else {
      const listing = await Listing.create({
        sellerId: toObjectId(userId),
        sellerUsername: user?.username || "",
        sellerBadge: "Base",
        itemName: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        price: item.price,
        image: item.images[0] || "",
        photos: item.images,
        status: "active",
      })
      item.listingId = listing._id
    }
    item.published = true
  } else {
    if (item.listingId) await Listing.findByIdAndUpdate(item.listingId, { status: "cancelled" })
    item.published = false
  }
  await item.save()
  return { ok: true, item }
}

async function unpublishAllForSeller(userId: string) {
  await connectDB()
  const items = await SellerInventoryItem.find({ sellerId: toObjectId(userId), published: true })
  for (const item of items) {
    if (item.listingId) await Listing.findByIdAndUpdate(item.listingId, { status: "cancelled" })
    item.published = false
    await item.save()
  }
}

// --- Orders & commissions ----------------------------------------------------

export interface OrderLineInput {
  inventoryItemId?: string
  title: string
  image?: string
  price: number
  quantity?: number
}

/** Creates a Pro order, computing commission and payout from the seller rate. */
export async function createSellerOrder(opts: {
  sellerId: string
  buyerId: string
  items: OrderLineInput[]
  stripePaymentIntentId?: string
  status?: "pending" | "paid"
}) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(opts.sellerId) })
  if (!profile || !profile.active) return { ok: false, error: "Venditore non attivo." }

  const lines = opts.items.map((l) => ({
    inventoryItemId: l.inventoryItemId ? toObjectId(l.inventoryItemId) : null,
    title: l.title,
    image: l.image || "",
    price: Math.max(0, l.price),
    quantity: Math.max(1, l.quantity ?? 1),
  }))
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  const rate = profile.commissionRate
  const commission = Math.round(total * rate * 100) / 100
  const payoutAmount = Math.round((total - commission) * 100) / 100

  const order = await SellerOrder.create({
    sellerId: profile.userId,
    buyerId: toObjectId(opts.buyerId),
    items: lines,
    total,
    commissionRate: rate,
    commission,
    payoutAmount,
    status: opts.status || "pending",
    stripePaymentIntentId: opts.stripePaymentIntentId || "",
  })
  return { ok: true, order }
}

export async function markOrderShipped(opts: {
  sellerId: string
  orderId: string
  carrier?: string
  trackingNumber?: string
}) {
  await connectDB()
  const order = await SellerOrder.findOne({ _id: toObjectId(opts.orderId), sellerId: toObjectId(opts.sellerId) })
  if (!order) return { ok: false, error: "Ordine non trovato." }
  if (!["paid", "pending"].includes(order.status))
    return { ok: false, error: "Ordine non spedibile in questo stato." }
  order.status = "shipped"
  order.trackingCarrier = opts.carrier || ""
  order.trackingNumber = opts.trackingNumber || ""
  order.shippedAt = new Date()
  await order.save()
  return { ok: true, order }
}

/** Marks an order completed and settles the seller payout. */
export async function completeOrder(opts: { orderId: string; byBuyerId?: string; bySellerId?: string }) {
  await connectDB()
  const query: Record<string, unknown> = { _id: toObjectId(opts.orderId) }
  if (opts.byBuyerId) query.buyerId = toObjectId(opts.byBuyerId)
  if (opts.bySellerId) query.sellerId = toObjectId(opts.bySellerId)
  const order = await SellerOrder.findOne(query)
  if (!order) return { ok: false, error: "Ordine non trovato." }
  if (order.status === "completed") return { ok: true, order }
  if (order.status === "cancelled") return { ok: false, error: "Ordine annullato." }

  order.status = "completed"
  order.completedAt = new Date()
  await order.save()

  await settlePayout(String(order._id))
  await recomputeSellerAggregates(String(order.sellerId))

  // Blocco 47 — record each sold line into price history (fires alerts) and
  // refresh the seller ranking. Fire-and-forget: never blocks order completion.
  for (const line of order.items || []) {
    recordSale({
      name: String(line.title || ""),
      category: String((line as { category?: string }).category || ""),
      price: Number(line.price) || 0,
      source: "seller_pro",
    }).catch(() => {})
  }
  computeSellerRanking(String(order.sellerId)).catch(() => {})
  return { ok: true, order }
}

/**
 * Settles the seller payout for a completed order. Uses a Stripe Connect
 * transfer when configured + onboarded; otherwise records a manual payout.
 */
export async function settlePayout(orderId: string) {
  await connectDB()
  const order = await SellerOrder.findById(toObjectId(orderId))
  if (!order || order.payoutSettled) return
  const profile = await SellerProfile.findOne({ userId: order.sellerId })
  if (!profile) return

  if (isStripeConfigured() && profile.stripeAccountId && profile.stripePayoutsEnabled && order.payoutAmount > 0) {
    try {
      const stripe = getStripe()
      const transfer = await stripe.transfers.create({
        amount: Math.round(order.payoutAmount * 100),
        currency: "eur",
        destination: profile.stripeAccountId,
        metadata: { sellerOrderId: String(order._id) },
      })
      order.stripeTransferId = transfer.id
    } catch {
      // Fall back to manual settlement on transfer failure.
    }
  }
  order.payoutSettled = true
  await order.save()
}

/** Recomputes lifetime aggregates from completed orders. */
export async function recomputeSellerAggregates(sellerId: string) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(sellerId) })
  if (!profile) return
  const agg = await SellerOrder.aggregate([
    { $match: { sellerId: toObjectId(sellerId) as Types.ObjectId, status: "completed" } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$total" },
        totalOrders: { $sum: 1 },
        totalCommission: { $sum: "$commission" },
        totalPayout: { $sum: "$payoutAmount" },
      },
    },
  ])
  const a = agg[0] || {}
  profile.totalSales = Math.round((a.totalSales || 0) * 100) / 100
  profile.totalOrders = a.totalOrders || 0
  profile.totalCommission = Math.round((a.totalCommission || 0) * 100) / 100
  profile.totalPayout = Math.round((a.totalPayout || 0) * 100) / 100
  await profile.save()
}

// --- Ratings -----------------------------------------------------------------

/** Records a seller rating (1-5) and maintains the running average. */
export async function addSellerRating(sellerId: string, score: number) {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(sellerId) })
  if (!profile) return { ok: false, error: "Profilo venditore non trovato." }
  const s = Math.min(5, Math.max(1, Math.round(score)))
  const newCount = profile.ratingCount + 1
  const newAvg = (profile.rating * profile.ratingCount + s) / newCount
  profile.rating = Math.round(newAvg * 100) / 100
  profile.ratingCount = newCount
  // Track the sustained-high-rating window for the Trusted Seller badge.
  if (profile.rating >= 4.8) {
    if (!profile.highRatingSince) profile.highRatingSince = new Date()
  } else {
    profile.highRatingSince = null
  }
  await profile.save()
  return { ok: true, profile }
}

// --- Serialization -----------------------------------------------------------

export function serializeProfile(p: InstanceType<typeof SellerProfile>) {
  return {
    id: String(p._id),
    userId: String(p.userId),
    username: p.username,
    active: p.active,
    commissionRate: p.commissionRate,
    totalSales: p.totalSales,
    totalOrders: p.totalOrders,
    totalCommission: p.totalCommission,
    totalPayout: p.totalPayout,
    rating: p.rating,
    ratingCount: p.ratingCount,
    stripe: {
      connected: Boolean(p.stripeAccountId),
      chargesEnabled: p.stripeChargesEnabled,
      payoutsEnabled: p.stripePayoutsEnabled,
      detailsSubmitted: p.stripeDetailsSubmitted,
    },
    createdAt: p.get("createdAt"),
  }
}

export function serializeInventoryItem(i: InstanceType<typeof SellerInventoryItem>) {
  return {
    id: String(i._id),
    cardId: i.cardId,
    title: i.title,
    description: i.description,
    category: i.category,
    condition: i.condition,
    price: i.price,
    quantity: i.quantity,
    images: i.images,
    published: i.published,
    listingId: i.listingId ? String(i.listingId) : null,
    updatedAt: i.get("updatedAt"),
  }
}

export function serializeOrder(o: InstanceType<typeof SellerOrder>) {
  return {
    id: String(o._id),
    sellerId: String(o.sellerId),
    buyerId: String(o.buyerId),
    items: (o.items || []).map((l: { title: string; image: string; price: number; quantity: number }) => ({
      title: l.title,
      image: l.image,
      price: l.price,
      quantity: l.quantity,
    })),
    total: o.total,
    commission: o.commission,
    payoutAmount: o.payoutAmount,
    status: o.status,
    trackingCarrier: o.trackingCarrier,
    trackingNumber: o.trackingNumber,
    payoutSettled: o.payoutSettled,
    reviewed: o.reviewed,
    createdAt: o.get("createdAt"),
    shippedAt: o.shippedAt,
    completedAt: o.completedAt,
  }
}
