import Listing from "@/lib/models/Listing"
import Auction from "@/lib/models/Auction"
import Trade from "@/lib/models/Trade"
import WishlistEntry, { type IWishlistEntry } from "@/lib/models/WishlistEntry"
import { suggestPrice } from "@/lib/ai-advisor"
import { buildValueHistory } from "@/lib/collection-helpers"

/**
 * Blocco 24 — AI Wishlist Engine.
 *
 * Pure read-only matching logic that scans the marketplace, trades and
 * auctions for items matching a user's intelligent wishlist entries. It does
 * not mutate any data and reuses the existing AI pricing helpers.
 */

export type WishlistOpportunityType =
  | "marketplace"
  | "trade"
  | "auction"
  | "price-drop"
  | "new-listing"
  | "rare"

export type WishlistSparkPose = "wishlist" | "deal" | "alert"

export interface WishlistOpportunity {
  type: WishlistOpportunityType
  /** The wishlist entry id this opportunity is for. */
  itemId: string
  /** Listing/auction/trade id (deep-link target), if any. */
  listingId: string | null
  /** Deep-link path for the UI. */
  href: string | null
  price: number | null
  title: string
  message: string
  sparkPose: WishlistSparkPose
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Ordered worst → best. Used to enforce a minimum acceptable condition.
const CONDITION_RANK: Record<string, number> = {
  danneggiato: 0,
  accettabile: 1,
  buono: 2,
  ottimo: 3,
  "come nuovo": 4,
  nuovo: 5,
  mint: 5,
}

function conditionRank(condition: string | null | undefined): number {
  if (!condition) return -1
  const key = condition.trim().toLowerCase()
  if (key in CONDITION_RANK) return CONDITION_RANK[key]
  // Fallback: partial contains check.
  for (const k of Object.keys(CONDITION_RANK)) {
    if (key.includes(k)) return CONDITION_RANK[k]
  }
  return -1
}

const RARE_TOKENS = ["rar", "epic", "leggend", "mitic", "segret", "ultra", "holo", "gold", "special", "limited"]

function isRare(rarity: string | null | undefined): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return RARE_TOKENS.some((t) => r.includes(t))
}

// Escape a user string for safe use inside a RegExp.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function nameRegex(itemName: string): RegExp {
  return new RegExp(escapeRegex(itemName.trim()), "i")
}

function eur(n: number): string {
  return `€ ${Math.round(n).toLocaleString("it-IT")}`
}

type LeanListing = {
  _id: unknown
  itemName: string
  category?: string
  rarity?: string
  condition?: string
  price: number
  value?: number
  createdAt?: Date
}

type LeanAuction = {
  _id: unknown
  itemName: string
  currentPrice: number
  startingPrice: number
  endsAt: Date
  bids?: unknown[]
}

type LeanTrade = {
  _id: unknown
  offeredItemName?: string
  requestedItemName?: string
  fromUsername?: string
}

/** Whether a marketplace listing satisfies a wishlist entry's hard filters. */
function listingMatches(item: IWishlistEntry, l: LeanListing): boolean {
  if (!nameRegex(item.itemName).test(l.itemName || "")) return false
  if (item.category && l.category && item.category.toLowerCase() !== l.category.toLowerCase()) return false
  if (item.rarity && l.rarity && !l.rarity.toLowerCase().includes(item.rarity.toLowerCase())) return false
  if (item.minCondition && conditionRank(l.condition) >= 0 && conditionRank(l.condition) < conditionRank(item.minCondition))
    return false
  return true
}

const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/* -------------------------------------------------------------------------- */
/* Matchers (spec §3)                                                         */
/* -------------------------------------------------------------------------- */

export async function findMarketplaceMatches(item: IWishlistEntry & { _id: unknown }): Promise<WishlistOpportunity[]> {
  const listings = (await Listing.find({ status: "active", itemName: nameRegex(item.itemName) })
    .sort({ price: 1 })
    .limit(12)
    .lean()) as unknown as LeanListing[]

  const itemId = String(item._id)
  return listings
    .filter((l) => listingMatches(item, l))
    .filter((l) => (item.maxPrice ? l.price <= item.maxPrice : true))
    .slice(0, 6)
    .map((l) => ({
      type: "marketplace" as const,
      itemId,
      listingId: String(l._id),
      href: `/market/item/${String(l._id)}`,
      price: l.price,
      title: l.itemName,
      message: `Disponibile nel marketplace a ${eur(l.price)}.`,
      sparkPose: "wishlist" as const,
    }))
}

export async function findTradeMatches(item: IWishlistEntry & { _id: unknown }): Promise<WishlistOpportunity[]> {
  const rx = nameRegex(item.itemName)
  const trades = (await Trade.find({
    status: "pending",
    $or: [{ offeredItemName: rx }, { requestedItemName: rx }],
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean()) as unknown as LeanTrade[]

  const itemId = String(item._id)
  return trades
    .filter((t) => rx.test(t.offeredItemName || "") || rx.test(t.requestedItemName || ""))
    .map((t) => ({
      type: "trade" as const,
      itemId,
      listingId: String(t._id),
      href: `/trades`,
      price: null,
      title: t.offeredItemName || t.requestedItemName || item.itemName,
      message: "Presente in uno scambio attivo: valuta una proposta o controproposta.",
      sparkPose: "wishlist" as const,
    }))
}

export async function findAuctionMatches(item: IWishlistEntry & { _id: unknown }): Promise<WishlistOpportunity[]> {
  const auctions = (await Auction.find({ status: "active", itemName: nameRegex(item.itemName), endsAt: { $gt: new Date() } })
    .sort({ endsAt: 1 })
    .limit(6)
    .lean()) as unknown as LeanAuction[]

  const itemId = String(item._id)
  return auctions.map((a) => {
    const underTarget = item.maxPrice ? a.currentPrice <= item.maxPrice : false
    return {
      type: "auction" as const,
      itemId,
      listingId: String(a._id),
      href: `/auctions/${String(a._id)}`,
      price: a.currentPrice,
      title: a.itemName,
      message: underTarget
        ? `Asta in corso a ${eur(a.currentPrice)} — sotto il tuo limite di ${eur(item.maxPrice as number)}.`
        : `Asta in corso, offerta attuale ${eur(a.currentPrice)}.`,
      sparkPose: "alert" as const,
    }
  })
}

export async function findPriceDrops(item: IWishlistEntry & { _id: unknown }): Promise<WishlistOpportunity[]> {
  const listings = (await Listing.find({ status: "active", itemName: nameRegex(item.itemName) })
    .sort({ price: 1 })
    .limit(12)
    .lean()) as unknown as LeanListing[]

  const itemId = String(item._id)
  const out: WishlistOpportunity[] = []
  for (const l of listings.filter((x) => listingMatches(item, x))) {
    const fair = suggestPrice({
      value: l.value || l.price,
      category: l.category,
      condition: l.condition,
      rarity: l.rarity,
    }).suggested
    const belowTarget = item.maxPrice != null && l.price <= item.maxPrice
    const belowFair = l.price < fair * 0.9
    if (belowTarget || belowFair) {
      out.push({
        type: "price-drop",
        itemId,
        listingId: String(l._id),
        href: `/market/item/${String(l._id)}`,
        price: l.price,
        title: l.itemName,
        message: belowFair
          ? `Prezzo ${eur(l.price)}, sotto il valore equo stimato ${eur(fair)}.`
          : `Prezzo ${eur(l.price)}, sotto il tuo prezzo obiettivo ${eur(item.maxPrice as number)}.`,
        sparkPose: "deal",
      })
    }
  }
  return out.slice(0, 6)
}

export async function findNewListings(item: IWishlistEntry & { _id: unknown }): Promise<WishlistOpportunity[]> {
  const since = new Date(Date.now() - NEW_LISTING_WINDOW_MS)
  const listings = (await Listing.find({
    status: "active",
    itemName: nameRegex(item.itemName),
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean()) as unknown as LeanListing[]

  const itemId = String(item._id)
  return listings
    .filter((l) => listingMatches(item, l))
    .map((l) => ({
      type: "new-listing" as const,
      itemId,
      listingId: String(l._id),
      href: `/market/item/${String(l._id)}`,
      price: l.price,
      title: l.itemName,
      message: `Nuovo annuncio corrispondente alla tua wishlist (${eur(l.price)}).`,
      sparkPose: "wishlist" as const,
    }))
}

export async function findRareOpportunities(item: IWishlistEntry & { _id: unknown }): Promise<WishlistOpportunity[]> {
  // Rare if the wishlist entry targets a rare rarity, or matching listings are scarce.
  const listings = (await Listing.find({ status: "active", itemName: nameRegex(item.itemName) })
    .limit(12)
    .lean()) as unknown as LeanListing[]

  const matching = listings.filter((l) => listingMatches(item, l))
  const itemId = String(item._id)
  const out: WishlistOpportunity[] = []

  const rareListings = matching.filter((l) => isRare(l.rarity) || isRare(item.rarity))
  const scarce = matching.length > 0 && matching.length <= 2

  for (const l of (rareListings.length > 0 ? rareListings : scarce ? matching : []).slice(0, 4)) {
    out.push({
      type: "rare",
      itemId,
      listingId: String(l._id),
      href: `/market/item/${String(l._id)}`,
      price: l.price,
      title: l.itemName,
      message: "Opportunità rara: questo pezzo è difficile da trovare.",
      sparkPose: "alert",
    })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

/** All opportunities for a single wishlist entry, de-duplicated by type+listing. */
export async function findOpportunitiesForItem(
  item: IWishlistEntry & { _id: unknown },
): Promise<WishlistOpportunity[]> {
  const groups = await Promise.all([
    findPriceDrops(item),
    findMarketplaceMatches(item),
    findNewListings(item),
    findAuctionMatches(item),
    findTradeMatches(item),
    findRareOpportunities(item),
  ])

  const seen = new Set<string>()
  const ordered: WishlistOpportunity[] = []
  for (const op of groups.flat()) {
    const key = `${op.type}:${op.listingId ?? "none"}`
    if (seen.has(key)) continue
    seen.add(key)
    ordered.push(op)
  }
  return ordered
}

export interface WishlistCheckResult {
  itemId: string
  itemName: string
  category: string
  maxPrice: number | null
  opportunities: WishlistOpportunity[]
  /** Lowest current marketplace price for the trend/price context. */
  bestPrice: number | null
  priceTrend: { label: string; value: number }[]
}

/** Runs the engine for every wishlist entry of a user. */
export async function checkWishlist(userId: string): Promise<WishlistCheckResult[]> {
  const entries = (await WishlistEntry.find({ userId }).sort({ createdAt: -1 }).lean()) as unknown as Array<
    IWishlistEntry & { _id: unknown }
  >

  return Promise.all(
    entries.map(async (entry) => {
      const opportunities = await findOpportunitiesForItem(entry)
      const priced = opportunities.filter((o) => typeof o.price === "number") as (WishlistOpportunity & {
        price: number
      })[]
      const bestPrice = priced.length > 0 ? Math.min(...priced.map((o) => o.price)) : null
      const priceTrend = bestPrice != null ? buildValueHistory(bestPrice, String(entry._id), 8) : []
      return {
        itemId: String(entry._id),
        itemName: entry.itemName,
        category: entry.category || "",
        maxPrice: entry.maxPrice ?? null,
        opportunities,
        bestPrice,
        priceTrend,
      }
    }),
  )
}
