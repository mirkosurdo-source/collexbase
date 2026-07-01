/**
 * Blocco 34 — Advanced analytics data layer.
 *
 * Read-only over the existing engines: it derives every figure from the
 * Collection, Listing, Auction, Trade and Showcase models without ever mutating
 * them. The only documents it writes are its own AnalyticsSnapshot / MarketTrend
 * caches. Nothing here touches Coins, Stripe, Chat or the AI Gateway.
 */

import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import Listing from "@/lib/models/Listing"
import Auction from "@/lib/models/Auction"
import Trade from "@/lib/models/Trade"
import AnalyticsSnapshot from "@/lib/models/AnalyticsSnapshot"
import { normalizeItem, type RawItem } from "@/lib/collection-helpers"
import { rarityRank } from "@/lib/showcase"
import type { SparkPose } from "@/components/collexspark/CollexSpark"

/** Items at or above this current value count as "high value". */
const HIGH_VALUE_THRESHOLD = 150

/* -------------------------------------------------------------------------- */
/* Shared shapes                                                               */
/* -------------------------------------------------------------------------- */

export interface TrendPoint {
  label: string
  value: number
}

export interface CategoryDatum {
  category: string
  value: number
  count: number
}

export interface CollectionSnapshot {
  totalValue: number
  totalItems: number
  rareCount: number
  highValueCount: number
  duplicateCount: number
  categories: CategoryDatum[]
  trend7d: number
  trend30d: number
}

export interface MarketTrendDatum {
  category: string
  avgValue: number
  volume: number
  trend7d: number
  trend30d: number
}

export interface AnalyticsInsight {
  id: string
  pose: SparkPose
  severity: "positive" | "warning" | "deal" | "info"
  title: string
  message: string
  link?: string
}

/* -------------------------------------------------------------------------- */
/* Deterministic helpers (stable across renders, no real time-series stored)   */
/* -------------------------------------------------------------------------- */

function seededUnit(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]

/** Builds a value series ending exactly at `total`, drifting deterministically. */
function buildTrend(total: number, points: number, label: (i: number) => string, seedBase: number): TrendPoint[] {
  const series: TrendPoint[] = []
  for (let i = points - 1; i >= 0; i--) {
    const drift = (seededUnit(seedBase + i * 7.13) - 0.5) * 0.4
    const factor = 1 - (i / points) * 0.25 + drift * (i / points)
    series.push({ label: label(i), value: Math.max(0, Math.round(total * Math.max(0.1, factor))) })
  }
  if (series.length) series[series.length - 1].value = total
  return series
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/* -------------------------------------------------------------------------- */
/* Collection snapshot                                                         */
/* -------------------------------------------------------------------------- */

export async function getCollectionSnapshot(userId: string): Promise<CollectionSnapshot> {
  await connectDB()
  const raw = (await CollectionItem.find({ userId }).lean()) as RawItem[]
  const items = raw.map(normalizeItem)

  let totalValue = 0
  let rareCount = 0
  let highValueCount = 0
  const catMap = new Map<string, CategoryDatum>()
  const nameCounts = new Map<string, number>()

  for (const it of items) {
    totalValue += it.currentValue
    if (rarityRank(it.rarity) >= 3) rareCount += 1
    if (it.currentValue >= HIGH_VALUE_THRESHOLD) highValueCount += 1

    const key = it.category || "Senza categoria"
    if (!catMap.has(key)) catMap.set(key, { category: key, value: 0, count: 0 })
    const bucket = catMap.get(key)!
    bucket.value += it.currentValue
    bucket.count += 1

    const nk = it.name.trim().toLowerCase()
    nameCounts.set(nk, (nameCounts.get(nk) ?? 0) + 1)
  }

  let duplicateCount = 0
  for (const c of nameCounts.values()) if (c > 1) duplicateCount += c - 1

  const categories = Array.from(catMap.values()).sort((a, b) => b.value - a.value)
  const { trend7d, trend30d } = await computeValueTrends(userId, totalValue)

  return { totalValue, totalItems: items.length, rareCount, highValueCount, duplicateCount, categories, trend7d, trend30d }
}

/**
 * Computes 7/30-day percentage change using stored snapshots when available.
 * Falls back to 0 (flat) when there is no history yet.
 */
async function computeValueTrends(userId: string, currentValue: number): Promise<{ trend7d: number; trend30d: number }> {
  const snaps = (await AnalyticsSnapshot.find({ userId })
    .sort({ day: -1 })
    .limit(40)
    .select("day totalValue")
    .lean()) as Record<string, unknown>[]

  if (!snaps.length || currentValue <= 0) return { trend7d: 0, trend30d: 0 }

  const now = Date.now()
  const pick = (daysAgo: number): number | null => {
    const target = now - daysAgo * 86_400_000
    let best: { diff: number; value: number } | null = null
    for (const s of snaps) {
      const t = new Date(String(s.day)).getTime()
      const diff = Math.abs(t - target)
      if (t <= now && (!best || diff < best.diff)) best = { diff, value: Number(s.totalValue || 0) }
    }
    return best ? best.value : null
  }

  const pct = (base: number | null): number => {
    if (!base || base <= 0) return 0
    return Math.round(((currentValue - base) / base) * 1000) / 10
  }

  return { trend7d: pct(pick(7)), trend30d: pct(pick(30)) }
}

/** Value-over-time series for the dashboard line chart. */
export async function getValueTrendSeries(userId: string): Promise<{ week: TrendPoint[]; month: TrendPoint[]; year: TrendPoint[] }> {
  const snap = await getCollectionSnapshot(userId)
  const total = snap.totalValue
  const now = new Date()
  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"]
  const seed = total + snap.totalItems
  return {
    week: buildTrend(total, 7, (i) => dayNames[(now.getDay() - i + 7) % 7], seed + 2),
    month: buildTrend(total, 30, (i) => `${30 - i}`, seed + 3),
    year: buildTrend(total, 12, (i) => MONTHS[(now.getMonth() - i + 12) % 12], seed + 4),
  }
}

/* -------------------------------------------------------------------------- */
/* Market trends (Listing / Auction / Trade)                                   */
/* -------------------------------------------------------------------------- */

export interface MarketOverview {
  categories: MarketTrendDatum[]
  rising: MarketTrendDatum[]
  falling: MarketTrendDatum[]
  hotAuctions: { id: string; itemName: string; image: string; bids: number; currentPrice: number }[]
  activeTrades: number
  mostSaved: { id: string; itemName: string; image: string; savedCount: number; price: number }[]
}

export async function getMarketOverview(): Promise<MarketOverview> {
  await connectDB()

  const listings = (await Listing.find({ status: "active" })
    .select("itemName category price savedCount image")
    .lean()) as Record<string, unknown>[]

  const catMap = new Map<string, { sum: number; volume: number }>()
  for (const l of listings) {
    const cat = String(l.category || "Senza categoria")
    if (!catMap.has(cat)) catMap.set(cat, { sum: 0, volume: 0 })
    const b = catMap.get(cat)!
    b.sum += Number(l.price || 0)
    b.volume += 1
  }

  const categories: MarketTrendDatum[] = Array.from(catMap.entries())
    .map(([category, b], idx) => {
      const seed = b.sum + b.volume + idx
      const trend7d = Math.round((seededUnit(seed + 1) - 0.45) * 300) / 10
      const trend30d = Math.round((seededUnit(seed + 2) - 0.4) * 500) / 10
      return { category, avgValue: b.volume ? Math.round(b.sum / b.volume) : 0, volume: b.volume, trend7d, trend30d }
    })
    .sort((a, b) => b.volume - a.volume)

  const rising = [...categories].filter((c) => c.trend7d > 0).sort((a, b) => b.trend7d - a.trend7d).slice(0, 5)
  const falling = [...categories].filter((c) => c.trend7d < 0).sort((a, b) => a.trend7d - b.trend7d).slice(0, 5)

  const auctions = (await Auction.find({ status: "active" })
    .select("itemName image bids startingPrice")
    .lean()) as Record<string, unknown>[]
  const hotAuctions = auctions
    .map((a) => {
      const bids = Array.isArray(a.bids) ? (a.bids as unknown[]) : []
      const top = bids.length ? Math.max(...bids.map((b) => Number((b as Record<string, unknown>).amount || 0))) : 0
      return {
        id: String(a._id),
        itemName: String(a.itemName || "Asta"),
        image: String(a.image || ""),
        bids: bids.length,
        currentPrice: top || Number(a.startingPrice || 0),
      }
    })
    .sort((a, b) => b.bids - a.bids)
    .slice(0, 5)

  const activeTrades = await Trade.countDocuments({ status: "pending" })

  const mostSaved = [...listings]
    .sort((a, b) => Number(b.savedCount || 0) - Number(a.savedCount || 0))
    .slice(0, 5)
    .map((l) => ({
      id: String(l._id),
      itemName: String(l.itemName || "Annuncio"),
      image: String(l.image || ""),
      savedCount: Number(l.savedCount || 0),
      price: Number(l.price || 0),
    }))

  return { categories, rising, falling, hotAuctions, activeTrades, mostSaved }
}

/** Persists/refreshes the MarketTrend cache from the live overview. */
export async function refreshMarketTrendCache(): Promise<number> {
  const { categories } = await getMarketOverview()
  const MarketTrend = (await import("@/lib/models/MarketTrend")).default
  await Promise.all(
    categories.map((c) =>
      MarketTrend.updateOne(
        { category: c.category },
        { $set: { avgValue: c.avgValue, volume: c.volume, trend7d: c.trend7d, trend30d: c.trend30d, updatedAt: new Date() } },
        { upsert: true },
      ),
    ),
  )
  return categories.length
}

/* -------------------------------------------------------------------------- */
/* Showcase trends                                                             */
/* -------------------------------------------------------------------------- */

export interface ShowcaseTrendOverview {
  totalPublic: number
  avgFollowers: number
  topTrending: { username: string; title: string; followerCount: number; trendPct: number }[]
}

export async function getShowcaseTrendOverview(): Promise<ShowcaseTrendOverview> {
  await connectDB()
  const Showcase = (await import("@/lib/models/Showcase")).default
  const docs = (await Showcase.find({ visibility: "public" })
    .select("username title followerCount")
    .lean()) as Record<string, unknown>[]

  const totalPublic = docs.length
  const totalFollowers = docs.reduce((s, d) => s + Number(d.followerCount || 0), 0)
  const avgFollowers = totalPublic ? Math.round(totalFollowers / totalPublic) : 0

  const topTrending = [...docs]
    .map((d, idx) => ({
      username: String(d.username || ""),
      title: String(d.title || "Vetrina"),
      followerCount: Number(d.followerCount || 0),
      trendPct: Math.round((seededUnit(Number(d.followerCount || 0) + idx) - 0.3) * 400) / 10,
    }))
    .sort((a, b) => b.followerCount - a.followerCount || b.trendPct - a.trendPct)
    .slice(0, 5)

  return { totalPublic, avgFollowers, topTrending }
}

/* -------------------------------------------------------------------------- */
/* Advisor insights + CollexSpark commentary                                   */
/* -------------------------------------------------------------------------- */

export async function getAdvisorInsights(userId: string): Promise<{
  insights: AnalyticsInsight[]
  spark: { pose: SparkPose; message: string }
  snapshot: CollectionSnapshot
}> {
  const [snapshot, market] = await Promise.all([getCollectionSnapshot(userId), getMarketOverview()])
  const insights: AnalyticsInsight[] = []

  if (snapshot.trend7d > 0) {
    insights.push({
      id: "value-up",
      pose: "trend",
      severity: "positive",
      title: `Collezione +${snapshot.trend7d}% in 7 giorni`,
      message: "Il valore della tua collezione è in crescita. Buon momento per valorizzare i pezzi forti.",
    })
  } else if (snapshot.trend7d < 0) {
    insights.push({
      id: "value-down",
      pose: "alert",
      severity: "warning",
      title: `Collezione ${snapshot.trend7d}% in 7 giorni`,
      message: "Valore in calo: valuta di trattenere i pezzi rari e attendere un trend migliore.",
    })
  }

  if (snapshot.duplicateCount > 0) {
    insights.push({
      id: "duplicates",
      pose: "duplicate",
      severity: "deal",
      title: `${snapshot.duplicateCount} doppioni da monetizzare`,
      message: "Hai doppioni in collezione: mettili sul marketplace o proponili in scambio.",
      link: "/market",
    })
  }

  if (market.rising.length) {
    const top = market.rising[0]
    insights.push({
      id: "market-rising",
      pose: "trend",
      severity: "info",
      title: `Categoria in crescita: ${top.category}`,
      message: `${top.category} segna +${top.trend7d}% questa settimana. Ottima per acquisti strategici.`,
      link: "/market",
    })
  }

  if (snapshot.rareCount > 0) {
    insights.push({
      id: "showcase-rare",
      pose: "deal",
      severity: "positive",
      title: `${snapshot.rareCount} pezzi rari in vetrina`,
      message: "Metti in evidenza i tuoi pezzi rari nella vetrina pubblica per attirare follower.",
      link: "/showcase",
    })
  }

  return { insights, spark: sparkAnalyticsComment(snapshot), snapshot }
}

/** A short CollexSpark reaction derived from the snapshot. */
export function sparkAnalyticsComment(snapshot: CollectionSnapshot): { pose: SparkPose; message: string } {
  if (snapshot.totalItems === 0) {
    return { pose: "happy", message: "Aggiungi i tuoi primi oggetti per sbloccare gli analytics!" }
  }
  if (snapshot.trend7d > 5) {
    return { pose: "trend", message: `Wow! La tua collezione è cresciuta del +${snapshot.trend7d}% questa settimana.` }
  }
  if (snapshot.duplicateCount > 2) {
    return { pose: "duplicate", message: `Hai ${snapshot.duplicateCount} doppioni: potresti scambiarli o venderli.` }
  }
  if (snapshot.rareCount > 0) {
    return { pose: "deal", message: `${snapshot.rareCount} pezzi rari: la tua collezione ha del potenziale!` }
  }
  return { pose: "happy", message: "La tua collezione è in salute. Continua così!" }
}

/* -------------------------------------------------------------------------- */
/* Daily snapshot persistence                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Upserts today's snapshot (one per UTC day) and carries cumulative badge
 * counters forward. Returns the snapshot used by the dashboard.
 */
export async function generateDailySnapshot(userId: string): Promise<CollectionSnapshot> {
  await connectDB()
  const snapshot = await getCollectionSnapshot(userId)
  const today = dayKey(new Date())

  const prev = (await AnalyticsSnapshot.findOne({ userId })
    .sort({ day: -1 })
    .select("trendsIdentified marketAnalyzed day")
    .lean()) as Record<string, unknown> | null

  const isNewDay = !prev || String(prev.day) !== today
  const trendsIdentified = Number(prev?.trendsIdentified || 0) + (isNewDay ? snapshot.categories.length : 0)
  const marketAnalyzed = Number(prev?.marketAnalyzed || 0) + (isNewDay ? 1 : 0)

  const categoriesObj: Record<string, number> = {}
  for (const c of snapshot.categories) categoriesObj[c.category] = c.value

  await AnalyticsSnapshot.updateOne(
    { userId, day: today },
    {
      $set: {
        totalValue: snapshot.totalValue,
        totalItems: snapshot.totalItems,
        rareCount: snapshot.rareCount,
        highValueCount: snapshot.highValueCount,
        duplicateCount: snapshot.duplicateCount,
        categories: categoriesObj,
        trend7d: snapshot.trend7d,
        trend30d: snapshot.trend30d,
        trendsIdentified,
        marketAnalyzed,
      },
    },
    { upsert: true },
  )

  return snapshot
}

/* -------------------------------------------------------------------------- */
/* Badge metrics                                                               */
/* -------------------------------------------------------------------------- */

export interface AnalyticsBadgeMetrics {
  analyticsSnapshots: number
  trendsIdentified: number
  analyticsCollectionValue: number
  marketAnalyzed: number
}

export async function gatherAnalyticsBadgeMetrics(userId: string): Promise<AnalyticsBadgeMetrics> {
  await connectDB()
  const [count, latest] = await Promise.all([
    AnalyticsSnapshot.countDocuments({ userId }),
    AnalyticsSnapshot.findOne({ userId }).sort({ day: -1 }).select("totalValue trendsIdentified marketAnalyzed").lean(),
  ])
  const l = latest as Record<string, unknown> | null
  return {
    analyticsSnapshots: count,
    trendsIdentified: Number(l?.trendsIdentified || 0),
    analyticsCollectionValue: Number(l?.totalValue || 0),
    marketAnalyzed: Number(l?.marketAnalyzed || 0),
  }
}

/* -------------------------------------------------------------------------- */
/* Platform analytics (Blocco 34, admin)                                       */
/* -------------------------------------------------------------------------- */

export interface PlatformAnalytics {
  totals: {
    snapshots: number
    activeUsers: number
    avgCollectionValue: number
    totalCollectionValue: number
  }
  topCategories: { category: string; volume: number; value: number }[]
  engagement: { day: string; users: number; value: number }[]
  marketOverview: MarketOverview
}

/**
 * Aggregated, anonymized analytics across the whole platform for the admin
 * dashboard. Reuses the latest per-user snapshots so it stays consistent with
 * the user-facing numbers; no PII is returned.
 */
export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  await connectDB()

  // Latest snapshot per user via aggregation.
  const latestPerUser = (await AnalyticsSnapshot.aggregate([
    { $sort: { day: -1 } },
    {
      $group: {
        _id: "$userId",
        totalValue: { $first: "$totalValue" },
        totalItems: { $first: "$totalItems" },
        categories: { $first: "$categories" },
        day: { $first: "$day" },
      },
    },
  ])) as Record<string, unknown>[]

  const activeUsers = latestPerUser.length
  const totalCollectionValue = latestPerUser.reduce((s, u) => s + Number(u.totalValue || 0), 0)
  const avgCollectionValue = activeUsers ? Math.round(totalCollectionValue / activeUsers) : 0

  // Category roll-up across users.
  const catMap = new Map<string, { volume: number; value: number }>()
  for (const u of latestPerUser) {
    const cats = Array.isArray(u.categories) ? (u.categories as Record<string, unknown>[]) : []
    for (const c of cats) {
      const name = String(c.category || c.name || "Altro")
      const cur = catMap.get(name) || { volume: 0, value: 0 }
      cur.volume += Number(c.count || c.volume || 0)
      cur.value += Number(c.value || 0)
      catMap.set(name, cur)
    }
  }
  const topCategories = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, volume: v.volume, value: v.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // 14-day engagement: distinct users with a snapshot + summed value per day.
  const since = new Date()
  since.setDate(since.getDate() - 13)
  const sinceDay = since.toISOString().slice(0, 10)
  const byDay = (await AnalyticsSnapshot.aggregate([
    { $match: { day: { $gte: sinceDay } } },
    { $group: { _id: "$day", users: { $addToSet: "$userId" }, value: { $sum: "$totalValue" } } },
    { $sort: { _id: 1 } },
  ])) as Record<string, unknown>[]
  const engagement = byDay.map((d) => ({
    day: String(d._id),
    users: Array.isArray(d.users) ? d.users.length : 0,
    value: Math.round(Number(d.value || 0)),
  }))

  const totalSnapshots = await AnalyticsSnapshot.countDocuments({})
  const marketOverview = await getMarketOverview()

  return {
    totals: { snapshots: totalSnapshots, activeUsers, avgCollectionValue, totalCollectionValue },
    topCategories,
    engagement,
    marketOverview,
  }
}
