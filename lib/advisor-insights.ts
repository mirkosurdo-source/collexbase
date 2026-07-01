import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import AIMetadata from "@/lib/models/AIMetadata"
import Listing from "@/lib/models/Listing"
import Trade from "@/lib/models/Trade"
import Auction from "@/lib/models/Auction"
import Wishlist from "@/lib/models/Wishlist"
import { suggestPrice, evaluateFairness } from "@/lib/ai-advisor"
import { isRarityHigh } from "@/lib/ai-valuation"

/**
 * Blocco 22 — CollexSpark AI Advisor insight engine.
 *
 * Aggregates the user's collection, marketplace, trades, auctions and wishlist
 * into explainable advice "cards", each tagged with a CollexSpark pose so the UI
 * can show the right mascot expression. All heuristics are deterministic and
 * reuse the Blocco 21 valuation/fairness helpers — no external model calls here.
 */

export type SparkPose = "happy" | "alert" | "deal" | "auction" | "duplicate" | "wishlist" | "trend"
export type Severity = "positive" | "warning" | "deal" | "info"

export interface Insight {
  id: string
  pose: SparkPose
  severity: Severity
  title: string
  message: string
  link?: string
  value?: number
}

export interface TrendPoint {
  label: string
  value: number
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function eur(n: number): string {
  return `€ ${Math.round(n || 0).toLocaleString("it-IT")}`
}

function normalizeName(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ")
}

interface CollectionItemLean {
  _id: unknown
  name: string
  category?: string
  condition?: string
  year?: number | null
  value?: number | null
  image?: string
}

interface MetaLean {
  objectId: string
  name?: string
  rarity?: string | null
  category?: string
  marketValue?: { estimated?: number; trend?: "up" | "stable" | "down"; forecast30d?: number }
  duplicates?: { total?: number; recommendedForSale?: number; recommendedForTrade?: number }
  advisor?: { sellNow?: boolean; hold?: boolean; auctionRecommended?: boolean; tradeRecommended?: boolean; reason?: string }
}

/* -------------------------------------------------------------------------- */
/* 1. Collection insights                                                     */
/* -------------------------------------------------------------------------- */

export interface CollectionInsights {
  cards: Insight[]
  buckets: {
    rising: string[]
    falling: string[]
    toSell: string[]
    toHold: string[]
    toAuction: string[]
    duplicates: string[]
    rare: string[]
    highDemand: string[]
    atRisk: string[]
  }
  categoryTrends: TrendPoint[]
  totals: { items: number; totalValue: number; forecastValue: number }
}

export async function generateCollectionInsights(userId: string): Promise<CollectionInsights> {
  await connectDB()
  const [items, metas] = await Promise.all([
    CollectionItem.find({ userId }).lean<CollectionItemLean[]>(),
    AIMetadata.find({ userId }).lean<MetaLean[]>(),
  ])

  const metaByObj = new Map<string, MetaLean>()
  for (const m of metas) metaByObj.set(String(m.objectId), m)

  const cards: Insight[] = []
  const buckets: CollectionInsights["buckets"] = {
    rising: [],
    falling: [],
    toSell: [],
    toHold: [],
    toAuction: [],
    duplicates: [],
    rare: [],
    highDemand: [],
    atRisk: [],
  }

  const categoryValue = new Map<string, number>()
  let totalValue = 0
  let forecastValue = 0

  // Duplicate detection by normalized name.
  const nameGroups = new Map<string, number>()
  for (const it of items) {
    const key = normalizeName(it.name)
    nameGroups.set(key, (nameGroups.get(key) || 0) + 1)
  }

  for (const it of items) {
    const id = String(it._id)
    const meta = metaByObj.get(id)
    const value = meta?.marketValue?.estimated || it.value || 0
    const trend = meta?.marketValue?.trend
    const forecast = meta?.marketValue?.forecast30d || value
    const rarity = meta?.rarity
    const category = meta?.category || it.category || "Altro"

    totalValue += value
    forecastValue += forecast
    categoryValue.set(category, (categoryValue.get(category) || 0) + value)

    const price = suggestPrice({
      value: value || 1,
      category,
      condition: it.condition || undefined,
      rarity: rarity || undefined,
      year: it.year ?? null,
    })

    if (trend === "up") {
      buckets.rising.push(it.name)
      cards.push({
        id: `coll-up-${id}`,
        pose: "trend",
        severity: "positive",
        title: `${it.name} in aumento`,
        message: `Il valore stimato sale verso ${eur(forecast)}. Buon momento per valutare la vendita.`,
        link: `/collections/${id}`,
        value,
      })
    } else if (trend === "down") {
      buckets.falling.push(it.name)
      buckets.atRisk.push(it.name)
      cards.push({
        id: `coll-down-${id}`,
        pose: "alert",
        severity: "warning",
        title: `${it.name} in calo`,
        message: `Trend negativo verso ${eur(forecast)}. CollexSpark consiglia di tenere e attendere.`,
        link: `/collections/${id}`,
        value,
      })
    }

    if (meta?.advisor?.sellNow) {
      buckets.toSell.push(it.name)
      cards.push({
        id: `coll-sell-${id}`,
        pose: "deal",
        severity: "deal",
        title: `Vendi ${it.name}`,
        message: meta.advisor.reason || `Condizioni favorevoli: prezzo consigliato ${eur(price.suggested)}.`,
        link: `/market/new?fromCollection=${id}`,
        value: price.suggested,
      })
    } else if (meta?.advisor?.hold) {
      buckets.toHold.push(it.name)
    }

    if (meta?.advisor?.auctionRecommended || isRarityHigh(rarity)) {
      buckets.toAuction.push(it.name)
      cards.push({
        id: `coll-auction-${id}`,
        pose: "auction",
        severity: "info",
        title: `Asta consigliata: ${it.name}`,
        message: `Oggetto raro con domanda elevata: un'asta potrebbe superare ${eur(price.suggested)}.`,
        link: `/auctions/new?fromCollection=${id}`,
        value: price.suggested,
      })
    }

    if (isRarityHigh(rarity)) buckets.rare.push(it.name)
    if (price.demand > 1.2) buckets.highDemand.push(it.name)
  }

  // Duplicate surplus cards.
  const seenDup = new Set<string>()
  for (const it of items) {
    const key = normalizeName(it.name)
    const count = nameGroups.get(key) || 1
    if (count > 1 && !seenDup.has(key)) {
      seenDup.add(key)
      buckets.duplicates.push(it.name)
      cards.push({
        id: `coll-dup-${key.replace(/\s+/g, "-")}`,
        pose: "duplicate",
        severity: "info",
        title: `Hai ${count} copie di ${it.name}`,
        message: `Puoi venderne ${count - 1} mantenendo la copia migliore.`,
        link: "/market/new",
      })
    }
  }

  const categoryTrends: TrendPoint[] = Array.from(categoryValue.entries())
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return {
    cards,
    buckets,
    categoryTrends,
    totals: { items: items.length, totalValue: Math.round(totalValue), forecastValue: Math.round(forecastValue) },
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Marketplace insights                                                    */
/* -------------------------------------------------------------------------- */

interface ListingLean {
  _id: unknown
  itemName: string
  category?: string
  condition?: string
  rarity?: string
  year?: number | null
  value?: number
  price: number
  image?: string
  sellerUsername?: string
  sellerBadge?: "Base" | "Gold" | "Premium"
}

export interface MarketplaceInsights {
  cards: Insight[]
  underpriced: Array<{ id: string; name: string; price: number; fair: number; image: string }>
  overpriced: Array<{ id: string; name: string; price: number; fair: number; image: string }>
  trustedSellers: string[]
}

export async function generateMarketplaceInsights(userId: string): Promise<MarketplaceInsights> {
  await connectDB()
  const listings = await Listing.find({ sellerId: { $ne: userId }, status: "active" })
    .sort({ createdAt: -1 })
    .limit(80)
    .lean<ListingLean[]>()

  const cards: Insight[] = []
  const underpriced: MarketplaceInsights["underpriced"] = []
  const overpriced: MarketplaceInsights["overpriced"] = []
  const trusted = new Set<string>()

  for (const l of listings) {
    const id = String(l._id)
    const ref = l.value && l.value > 0 ? l.value : l.price
    const fair = suggestPrice({
      value: ref,
      category: l.category,
      condition: l.condition,
      rarity: l.rarity,
      year: l.year ?? null,
    }).suggested

    if (l.sellerBadge === "Premium" || l.sellerBadge === "Gold") {
      if (l.sellerUsername) trusted.add(l.sellerUsername)
    }

    if (l.price <= fair * 0.85) {
      underpriced.push({ id, name: l.itemName, price: l.price, fair, image: l.image || "" })
      cards.push({
        id: `mkt-deal-${id}`,
        pose: "deal",
        severity: "deal",
        title: `Occasione: ${l.itemName}`,
        message: `Prezzo ${eur(l.price)}, sotto la stima di ${eur(fair)}. ${isRarityHigh(l.rarity) ? "Pezzo raro, prendilo ora!" : "Buon affare!"}`,
        link: `/market/item/${id}`,
        value: l.price,
      })
    } else if (l.price >= fair * 1.2) {
      overpriced.push({ id, name: l.itemName, price: l.price, fair, image: l.image || "" })
    }
  }

  // Best deals first.
  cards.sort((a, b) => (a.value ?? 0) - (b.value ?? 0))

  return { cards: cards.slice(0, 20), underpriced, overpriced, trustedSellers: Array.from(trusted).slice(0, 12) }
}

/* -------------------------------------------------------------------------- */
/* 3. Trade insights                                                          */
/* -------------------------------------------------------------------------- */

interface TradeLean {
  _id: unknown
  fromUserId: string
  toUserId: string
  offeredItemId: string
  offeredItemName: string
  requestedItemId: string
  requestedItemName: string
  status: string
}

async function valueForItem(itemId: string, fallbackUserId: string): Promise<number> {
  // Prefer AI estimated value, else the collection item's declared value.
  const meta = await AIMetadata.findOne({ objectId: itemId }).lean<{ marketValue?: { estimated?: number } }>()
  if (meta?.marketValue?.estimated) return meta.marketValue.estimated
  const item = await CollectionItem.findById(itemId).lean<{ value?: number }>()
  if (item?.value) return item.value
  void fallbackUserId
  return 0
}

export interface TradeInsights {
  cards: Insight[]
  evaluations: Array<{
    id: string
    role: "incoming" | "outgoing"
    offeredItemName: string
    requestedItemName: string
    offeredValue: number
    requestedValue: number
    verdict: string
    score: number
  }>
}

export async function generateTradeInsights(userId: string): Promise<TradeInsights> {
  await connectDB()
  const trades = await Trade.find({ $or: [{ fromUserId: userId }, { toUserId: userId }], status: "pending" })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean<TradeLean[]>()

  const cards: Insight[] = []
  const evaluations: TradeInsights["evaluations"] = []

  for (const t of trades) {
    const id = String(t._id)
    const isRecipient = t.toUserId === userId
    const [offeredValue, requestedValue] = await Promise.all([
      valueForItem(t.offeredItemId, t.fromUserId),
      valueForItem(t.requestedItemId, t.toUserId),
    ])

    // From the recipient's perspective: they give up the requested item and
    // receive the offered item. For the proposer it's the inverse.
    const give = isRecipient ? requestedValue : offeredValue
    const get = isRecipient ? offeredValue : requestedValue
    const fairness = evaluateFairness({ askValue: give || 1, offerValue: get })

    evaluations.push({
      id,
      role: isRecipient ? "incoming" : "outgoing",
      offeredItemName: t.offeredItemName,
      requestedItemName: t.requestedItemName,
      offeredValue,
      requestedValue,
      verdict: fairness.verdict,
      score: fairness.score,
    })

    if (fairness.verdict === "ottima" || fairness.verdict === "equa") {
      cards.push({
        id: `trade-good-${id}`,
        pose: "happy",
        severity: "positive",
        title: `Scambio ${fairness.verdict}: ${t.offeredItemName}`,
        message: `${fairness.message} ${isRecipient ? "Conviene accettare." : "La tua proposta è competitiva."}`,
        link: `/trades/${id}`,
        value: get,
      })
    } else {
      cards.push({
        id: `trade-risk-${id}`,
        pose: "alert",
        severity: "warning",
        title: `Scambio ${fairness.verdict}`,
        message: `${fairness.message} ${isRecipient ? "Valuta una controproposta più equilibrata." : "Considera di migliorare l'offerta."}`,
        link: `/trades/${id}`,
        value: get,
      })
    }
  }

  return { cards, evaluations }
}

/* -------------------------------------------------------------------------- */
/* 4. Auction insights                                                        */
/* -------------------------------------------------------------------------- */

interface AuctionLean {
  _id: unknown
  itemName: string
  startingPrice: number
  currentPrice: number
  bids?: unknown[]
  image?: string
  endsAt: string | Date
  userId: string
}

export interface AuctionInsights {
  cards: Insight[]
  undervalued: Array<{ id: string; name: string; currentPrice: number; bids: number; image: string }>
}

export async function generateAuctionInsights(userId: string): Promise<AuctionInsights> {
  await connectDB()
  const auctions = await Auction.find({ status: "active", userId: { $ne: userId } })
    .sort({ endsAt: 1 })
    .limit(40)
    .lean<AuctionLean[]>()

  const cards: Insight[] = []
  const undervalued: AuctionInsights["undervalued"] = []
  const now = Date.now()

  for (const a of auctions) {
    const id = String(a._id)
    const bidCount = Array.isArray(a.bids) ? a.bids.length : 0
    const endsMs = new Date(a.endsAt).getTime()
    const hoursLeft = (endsMs - now) / 36e5
    const nearStart = a.currentPrice <= a.startingPrice * 1.1

    // Few bids + still near the starting price = likely undervalued entry point.
    if (bidCount <= 1 && nearStart) {
      undervalued.push({ id, name: a.itemName, currentPrice: a.currentPrice, bids: bidCount, image: a.image || "" })
      cards.push({
        id: `auc-deal-${id}`,
        pose: "auction",
        severity: "deal",
        title: `Asta sottoprezzata: ${a.itemName}`,
        message: `Solo ${bidCount} offerte a ${eur(a.currentPrice)}${hoursLeft > 0 && hoursLeft < 24 ? ` e si chiude tra ${Math.max(1, Math.round(hoursLeft))}h` : ""}. Entra ora!`,
        link: `/auctions/${id}`,
        value: a.currentPrice,
      })
    }
  }

  // Suggest auctioning the user's own rare items.
  const rareMetas = await AIMetadata.find({ userId, rarity: { $ne: null } })
    .limit(50)
    .lean<MetaLean[]>()
  for (const m of rareMetas) {
    if (isRarityHigh(m.rarity) && m.advisor?.auctionRecommended) {
      cards.push({
        id: `auc-own-${m.objectId}`,
        pose: "auction",
        severity: "info",
        title: `Metti all'asta ${m.name || "un pezzo raro"}`,
        message: `Oggetto raro della tua collezione: l'asta può massimizzare il prezzo finale.`,
        link: `/auctions/new?fromCollection=${m.objectId}`,
      })
    }
  }

  return { cards, undervalued }
}

/* -------------------------------------------------------------------------- */
/* 5. Wishlist insights                                                       */
/* -------------------------------------------------------------------------- */

interface WishlistLean {
  items: { name: string; category?: string; targetPrice?: number }[]
}

export interface WishlistInsights {
  cards: Insight[]
  matches: Array<{ listingId: string; name: string; price: number; targetPrice: number; image: string; belowTarget: boolean }>
}

export async function generateWishlistInsights(userId: string): Promise<WishlistInsights> {
  await connectDB()
  const wishlist = await Wishlist.findOne({ userId }).lean<WishlistLean>()
  const cards: Insight[] = []
  const matches: WishlistInsights["matches"] = []
  if (!wishlist || wishlist.items.length === 0) return { cards, matches }

  for (const wish of wishlist.items) {
    const name = (wish.name || "").trim()
    if (!name) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const listings = await Listing.find({
      sellerId: { $ne: userId },
      status: "active",
      itemName: { $regex: escaped, $options: "i" },
    })
      .select("itemName price image rarity")
      .limit(5)
      .lean<Array<{ _id: unknown; itemName: string; price: number; image?: string; rarity?: string }>>()

    for (const l of listings) {
      const id = String(l._id)
      const target = wish.targetPrice || 0
      const belowTarget = target > 0 ? l.price <= target : true
      matches.push({ listingId: id, name: l.itemName, price: l.price, targetPrice: target, image: l.image || "", belowTarget })
      cards.push({
        id: `wish-${id}`,
        pose: "wishlist",
        severity: belowTarget ? "deal" : "info",
        title: `Wishlist disponibile: ${l.itemName}`,
        message: belowTarget
          ? `Disponibile a ${eur(l.price)}${target > 0 ? `, sotto il tuo obiettivo di ${eur(target)}` : ""}. Prendilo ora!`
          : `Disponibile a ${eur(l.price)} (obiettivo ${eur(target)}).`,
        link: `/market/item/${id}`,
        value: l.price,
      })
    }
  }

  cards.sort((a, b) => (a.severity === "deal" ? -1 : 1) - (b.severity === "deal" ? -1 : 1))
  return { cards, matches }
}

/* -------------------------------------------------------------------------- */
/* Headline pose: which CollexSpark expression leads the dashboard            */
/* -------------------------------------------------------------------------- */

export function headlinePose(allCards: Insight[]): SparkPose {
  if (allCards.some((c) => c.severity === "warning")) return "alert"
  if (allCards.some((c) => c.pose === "deal")) return "deal"
  if (allCards.some((c) => c.pose === "wishlist")) return "wishlist"
  if (allCards.some((c) => c.pose === "trend")) return "trend"
  return "happy"
}
