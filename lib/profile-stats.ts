/**
 * Blocco 27 — aggregates every public signal for the advanced profile.
 *
 * Read-only: it never mutates any existing collection, listing, trade, auction,
 * community or AI data. All counts are derived from existing models so the
 * profile stays consistent with the rest of the platform.
 */

import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import CollectionItem from "@/lib/models/Collection"
import Listing from "@/lib/models/Listing"
import Escrow from "@/lib/models/Escrow"
import Trade from "@/lib/models/Trade"
import Auction from "@/lib/models/Auction"
import Post from "@/lib/models/Post"
import Comment from "@/lib/models/Comment"
import Follow from "@/lib/models/Follow"
import AIMetadata from "@/lib/models/AIMetadata"
import WishlistEntry from "@/lib/models/WishlistEntry"
import CoinStorePurchase from "@/lib/models/CoinStorePurchase"
import Review from "@/lib/models/Review"
import { gatherChatStats } from "@/lib/chat-stats"
import { gatherGroupBadgeMetrics } from "@/lib/groups"
import { gatherShowcaseBadgeMetrics } from "@/lib/showcase"
import { gatherBoostBadgeMetrics } from "@/lib/boost"
import { gatherAnalyticsBadgeMetrics } from "@/lib/analytics"
import { gatherModerationBadgeRaw } from "@/lib/moderation-stats"
import { gatherApiBadgeRaw } from "@/lib/api-stats"
import { gatherAffiliateBadgeRaw } from "@/lib/affiliate-stats"
import { gatherSellerBadgeMetrics } from "@/lib/seller-stats"
import { normalizeItem, type RawItem } from "@/lib/collection-helpers"
import type { BadgeMetrics } from "@/lib/badges"

function toObjectId(id: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

export interface ProfileStats extends BadgeMetrics {
  followers: number
  following: number
  comments: number
  collectionValue: number
}

export interface ActivityEntry {
  type: "item" | "sale" | "trade" | "auction" | "post" | "comment"
  label: string
  detail: string
  at: string
}

export interface CollectionHighlight {
  id: string
  name: string
  image: string
  category: string
  rarity: string
  currentValue: number
}

/** Gathers all numeric signals used for badges, levels and profile stats. */
export async function gatherProfileStats(userId: string): Promise<ProfileStats> {
  await connectDB()
  const oid = toObjectId(userId)

  const [
    items,
    sales,
    trades,
    auctionsWon,
    posts,
    comments,
    likeAgg,
    aiEvaluations,
    wishlistItems,
    coinsAgg,
    followers,
    following,
    collectionValueAgg,
    reviewsWritten,
    chatStats,
    groupMetrics,
    showcaseMetrics,
    boostMetrics,
    analyticsMetrics,
    moderationRaw,
    apiRaw,
    affiliateRaw,
    sellerMetrics,
  ] = await Promise.all([
    CollectionItem.countDocuments({ userId: oid }),
    Escrow.countDocuments({ sellerId: oid, status: "released" }),
    Trade.countDocuments({ status: "accepted", $or: [{ fromUserId: userId }, { toUserId: userId }] }),
    Auction.countDocuments({ status: "closed", highestBidderId: userId }),
    Post.countDocuments({ authorId: oid }),
    Comment.countDocuments({ authorId: oid }),
    Post.aggregate([{ $match: { authorId: oid } }, { $group: { _id: null, total: { $sum: "$likeCount" } } }]),
    AIMetadata.countDocuments({ userId }),
    WishlistEntry.countDocuments({ userId }),
    CoinStorePurchase.aggregate([
      { $match: { userId, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$coins" } } },
    ]),
    Follow.countDocuments({ sellerId: userId }),
    Follow.countDocuments({ followerId: userId }),
    CollectionItem.aggregate([
      { $match: { userId: oid } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$currentValue", "$value"] } } } },
    ]),
    Review.countDocuments({ authorId: oid }),
    gatherChatStats(userId),
    gatherGroupBadgeMetrics(userId),
    gatherShowcaseBadgeMetrics(userId),
    gatherBoostBadgeMetrics(userId),
    gatherAnalyticsBadgeMetrics(userId),
    gatherModerationBadgeRaw(userId),
    gatherApiBadgeRaw(userId),
    gatherAffiliateBadgeRaw(userId),
    gatherSellerBadgeMetrics(userId),
  ])

  return {
    items,
    sales,
    trades,
    auctionsWon,
    likesReceived: likeAgg[0]?.total ?? 0,
    posts,
    aiEvaluations,
    wishlistItems,
    coinsPurchased: coinsAgg[0]?.total ?? 0,
    reviewsWritten,
    conversations: chatStats.conversations,
    messagesSent: chatStats.messagesSent,
    groupPosts: groupMetrics.groupPosts,
    groupMembersLed: groupMetrics.groupMembersLed,
    groupsJoined: groupMetrics.groupsJoined,
    groupMessages: groupMetrics.groupMessages,
    showcaseExposedItems: showcaseMetrics.showcaseExposedItems,
    showcaseThemes: showcaseMetrics.showcaseThemes,
    showcaseRareItems: showcaseMetrics.showcaseRareItems,
    showcaseExposedValue: showcaseMetrics.showcaseExposedValue,
    boostMarketplaceCount: boostMetrics.boostMarketplaceCount,
    boostAuctionCount: boostMetrics.boostAuctionCount,
    boostTradeCount: boostMetrics.boostTradeCount,
    boostShowcaseCount: boostMetrics.boostShowcaseCount,
    analyticsSnapshots: analyticsMetrics.analyticsSnapshots,
    trendsIdentified: analyticsMetrics.trendsIdentified,
    analyticsCollectionValue: analyticsMetrics.analyticsCollectionValue,
    marketAnalyzed: analyticsMetrics.marketAnalyzed,
    guardianReports: moderationRaw.guardianReports,
    detectiveDetections: moderationRaw.detectiveDetections,
    safeTrades: Math.max(0, trades - moderationRaw.tradeFlags),
    communityCleaned: Math.max(0, posts - moderationRaw.communityFlags),
    apiCalls: apiRaw.apiCalls,
    webhookDeliveries: apiRaw.webhookDeliveries,
    analyticsApiCalls: apiRaw.analyticsApiCalls,
    referralInvites: affiliateRaw.referralInvites,
    creatorActivated: affiliateRaw.creatorActivated,
    creatorUsersInvited: affiliateRaw.creatorUsersInvited,
    creatorCreditsEarned: affiliateRaw.creatorCreditsEarned,
    sellerActive: sellerMetrics.sellerActive,
    sellerCompletedOrders: sellerMetrics.sellerCompletedOrders,
    sellerTrustedMonths: sellerMetrics.sellerTrustedMonths,
    followers,
    following,
    comments,
    collectionValue: Math.round(collectionValueAgg[0]?.total ?? 0),
  }
}

/** Merges recent events from all surfaces into a single sorted timeline. */
export async function gatherRecentActivity(userId: string, limit = 12): Promise<ActivityEntry[]> {
  await connectDB()
  const oid = toObjectId(userId)

  const [items, listings, trades, auctions, posts, comments] = await Promise.all([
    CollectionItem.find({ userId: oid }).select("name createdAt").sort({ createdAt: -1 }).limit(6).lean(),
    Listing.find({ sellerId: oid, status: "sold" }).select("itemName price updatedAt").sort({ updatedAt: -1 }).limit(6).lean(),
    Trade.find({ status: "accepted", $or: [{ fromUserId: userId }, { toUserId: userId }] })
      .select("offeredItemName createdAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Auction.find({ status: "closed", highestBidderId: userId }).select("itemName currentPrice updatedAt").sort({ updatedAt: -1 }).limit(6).lean(),
    Post.find({ authorId: oid }).select("title kind createdAt").sort({ createdAt: -1 }).limit(6).lean(),
    Comment.find({ authorId: oid }).select("body createdAt").sort({ createdAt: -1 }).limit(6).lean(),
  ])

  const entries: ActivityEntry[] = []
  for (const i of items as RawItem[]) {
    entries.push({ type: "item", label: "Nuovo oggetto", detail: String(i.name ?? ""), at: new Date(i.createdAt as string).toISOString() })
  }
  for (const l of listings as RawItem[]) {
    entries.push({ type: "sale", label: "Vendita completata", detail: String(l.itemName ?? ""), at: new Date((l.updatedAt as string) ?? Date.now()).toISOString() })
  }
  for (const t of trades as RawItem[]) {
    entries.push({ type: "trade", label: "Scambio completato", detail: String(t.offeredItemName ?? "Scambio"), at: new Date(t.createdAt as string).toISOString() })
  }
  for (const a of auctions as RawItem[]) {
    entries.push({ type: "auction", label: "Asta vinta", detail: String(a.itemName ?? ""), at: new Date((a.updatedAt as string) ?? Date.now()).toISOString() })
  }
  for (const p of posts as RawItem[]) {
    entries.push({
      type: "post",
      label: p.kind === "blog" ? "Articolo pubblicato" : "Post pubblicato",
      detail: String(p.title || "Post nella community"),
      at: new Date(p.createdAt as string).toISOString(),
    })
  }
  for (const c of comments as RawItem[]) {
    entries.push({ type: "comment", label: "Commento", detail: String(c.body ?? "").slice(0, 80), at: new Date(c.createdAt as string).toISOString() })
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit)
}

/** Returns the rarest / most valuable public collection items. */
export async function gatherCollectionHighlights(userId: string): Promise<{
  topValued: CollectionHighlight[]
  rarest: CollectionHighlight[]
  duplicates: number
}> {
  await connectDB()
  const oid = toObjectId(userId)
  const raw = (await CollectionItem.find({ userId: oid }).sort({ createdAt: -1 }).lean()) as RawItem[]
  const items = raw.map(normalizeItem)

  const RARITY_RANK: Record<string, number> = {
    leggendaria: 5,
    leggendario: 5,
    epica: 4,
    epico: 4,
    rara: 3,
    raro: 3,
    "non comune": 2,
    comune: 1,
  }
  const rank = (r: string) => RARITY_RANK[r.toLowerCase()] ?? 0

  const toHighlight = (i: ReturnType<typeof normalizeItem>): CollectionHighlight => ({
    id: i.id,
    name: i.name,
    image: i.image,
    category: i.category,
    rarity: i.rarity,
    currentValue: i.currentValue,
  })

  const topValued = [...items].sort((a, b) => b.currentValue - a.currentValue).slice(0, 6).map(toHighlight)
  const rarest = [...items].sort((a, b) => rank(b.rarity) - rank(a.rarity) || b.currentValue - a.currentValue).slice(0, 6).map(toHighlight)

  // Count duplicates by normalized name.
  const seen = new Map<string, number>()
  for (const i of items) {
    const key = i.name.trim().toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  let duplicates = 0
  for (const c of seen.values()) if (c > 1) duplicates += c - 1

  return { topValued, rarest, duplicates }
}

/** CollexSpark personalised tips based on the profile stats (presentational). */
export function buildProfileAdvice(stats: ProfileStats): { pose: string; message: string }[] {
  const tips: { pose: string; message: string }[] = []

  if (stats.items === 0) {
    tips.push({ pose: "happy", message: "Aggiungi il tuo primo oggetto per sbloccare il badge Collezionista!" })
  } else if (stats.items < 10) {
    tips.push({ pose: "happy", message: `Ti mancano ${10 - stats.items} oggetti per il badge Collezionista Bronze.` })
  } else if (stats.items < 50) {
    tips.push({ pose: "trend", message: `Ottima collezione! ${50 - stats.items} oggetti al badge Silver.` })
  }

  if (stats.sales === 0) {
    tips.push({ pose: "deal", message: "Metti in vendita un duplicato per diventare Venditore affidabile." })
  }
  if (stats.aiEvaluations === 0) {
    tips.push({ pose: "trend", message: "Prova una valutazione AI per scoprire il valore reale dei tuoi pezzi." })
  }
  if (stats.wishlistItems === 0) {
    tips.push({ pose: "wishlist", message: "Aggiungi desideri alla wishlist: ti avviserò appena compaiono offerte." })
  }
  if (stats.posts === 0) {
    tips.push({ pose: "happy", message: "Pubblica il tuo primo post nella community per iniziare a guadagnare like." })
  }
  if (!tips.length) {
    tips.push({ pose: "happy", message: "Sei un collezionista completo! Continua così per scalare la classifica." })
  }

  return tips.slice(0, 3)
}
