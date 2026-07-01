import { analyzeTextHeuristics } from "@/lib/moderation"

/**
 * Blocco 43 — shared utilities for Live Auctions & Live Trades.
 *
 * Pure, additive helpers: chat moderation (anti-spam / anti-insult /
 * anti-link), anti-abuse rate limits and JSON serialization. Nothing here
 * mutates the classic auction/trade/marketplace engines.
 */

/* ----------------------------- Config ----------------------------------- */

export const LIVE_LIMITS = {
  maxLiveAuctionsPerDay: 3,
  maxLiveTradesPerDay: 10,
  /** Minimum gap between two bids from the same user (ms). */
  bidCooldownMs: 1000,
  /** Minimum gap between two chat messages from the same user (ms). */
  chatCooldownMs: 1500,
  maxChatLength: 500,
  /** Default live-trade duration (seconds). */
  tradeTimerSeconds: 300,
} as const

/* --------------------------- Chat moderation ----------------------------- */

const EXTERNAL_LINK_RE = /(https?:\/\/|www\.)\S+/i
// Bare domains like "foo.com/bar" or "t.me/xyz" that skip the protocol.
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(com|net|org|io|me|gg|ru|xyz|link|shop|store|info|biz|to|cc|tv)\b/i

export interface ChatModerationResult {
  ok: boolean
  reason?: string
}

/**
 * Validates a live chat message. Blocks empty/oversized text, external links
 * (anti-scam) and toxic/spam content via the existing heuristics engine.
 */
export function moderateChatMessage(raw: string): ChatModerationResult {
  const text = (raw || "").trim()
  if (!text) return { ok: false, reason: "Messaggio vuoto." }
  if (text.length > LIVE_LIMITS.maxChatLength) {
    return { ok: false, reason: "Messaggio troppo lungo." }
  }
  if (EXTERNAL_LINK_RE.test(text) || BARE_DOMAIN_RE.test(text)) {
    return { ok: false, reason: "I link esterni non sono consentiti in chat." }
  }
  const verdict = analyzeTextHeuristics(text)
  if (verdict.flagged && (verdict.category === "toxic" || verdict.category === "threat")) {
    return { ok: false, reason: "Linguaggio offensivo non consentito." }
  }
  if (verdict.flagged && (verdict.category === "spam" || verdict.category === "scam" || verdict.category === "phishing")) {
    return { ok: false, reason: "Messaggio bloccato: contenuto sospetto." }
  }
  return { ok: true }
}

/* ----------------------------- Rate limits ------------------------------- */

/** Returns the start of the current day (server local time). */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** True if the latest action timestamp is within the cooldown window. */
export function withinCooldown(lastAt: Date | string | null | undefined, cooldownMs: number): boolean {
  if (!lastAt) return false
  const last = new Date(lastAt).getTime()
  if (Number.isNaN(last)) return false
  return Date.now() - last < cooldownMs
}

/* ---------------------------- Serialization ------------------------------ */

type AnyDoc = Record<string, unknown>

function iso(value: unknown): string | null {
  if (!value) return null
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Serializes a LiveAuction document for the client. */
export function serializeLiveAuction(doc: AnyDoc, viewerId?: string | null) {
  const bids = Array.isArray(doc.bids) ? (doc.bids as AnyDoc[]) : []
  const chat = Array.isArray(doc.chat) ? (doc.chat as AnyDoc[]) : []
  return {
    id: String(doc._id),
    sellerId: String(doc.sellerId || ""),
    sellerUsername: String(doc.sellerUsername || ""),
    itemId: String(doc.itemId || ""),
    itemName: String(doc.itemName || ""),
    description: String(doc.description || ""),
    image: String(doc.image || ""),
    startPrice: Number(doc.startPrice || 0),
    currentPrice: Number(doc.currentPrice || 0),
    minIncrement: Number(doc.minIncrement || 1),
    highestBidderId: doc.highestBidderId ? String(doc.highestBidderId) : null,
    highestBidderUsername: String(doc.highestBidderUsername || ""),
    status: String(doc.status || "live"),
    startAt: iso(doc.startAt),
    endAt: iso(doc.endAt),
    autoExtend: Boolean(doc.autoExtend),
    autoExtendSeconds: Number(doc.autoExtendSeconds || 0),
    extensionsCount: Number(doc.extensionsCount || 0),
    orderId: doc.orderId ? String(doc.orderId) : null,
    // Blocco 51 — non-payment fine fields.
    finalPrice: doc.finalPrice != null ? Number(doc.finalPrice) : null,
    winnerId: doc.winnerId ? String(doc.winnerId) : null,
    paymentDeadline: iso(doc.paymentDeadline),
    paymentStatus: String(doc.paymentStatus || "none"),
    finePercentage: Number(doc.finePercentage ?? 20),
    fineApplied: Boolean(doc.fineApplied),
    fineAmountCollex: Number(doc.fineAmountCollex || 0),
    isWinner: viewerId ? String(doc.winnerId || "") === String(viewerId) : false,
    isSeller: viewerId ? String(doc.sellerId) === String(viewerId) : false,
    isWinning: viewerId ? String(doc.highestBidderId || "") === String(viewerId) : false,
    bidCount: bids.length,
    bids: bids
      .map((b) => ({
        id: String(b._id || ""),
        userId: String(b.userId || ""),
        username: String(b.username || ""),
        amount: Number(b.amount || 0),
        createdAt: iso(b.createdAt),
      }))
      .sort((a, z) => z.amount - a.amount),
    chat: chat.map((m) => ({
      id: String(m._id || ""),
      userId: String(m.userId || ""),
      username: String(m.username || ""),
      message: String(m.message || ""),
      system: Boolean(m.system),
      createdAt: iso(m.createdAt),
    })),
  }
}

function serializeItems(items: unknown): Array<{ id: string; itemId: string; name: string; image: string; addedBy: string }> {
  if (!Array.isArray(items)) return []
  return (items as AnyDoc[]).map((it) => ({
    id: String(it._id || ""),
    itemId: String(it.itemId || ""),
    name: String(it.name || ""),
    image: String(it.image || ""),
    addedBy: String(it.addedBy || ""),
  }))
}

/** Serializes a LiveTrade document for the client. */
export function serializeLiveTrade(doc: AnyDoc, viewerId?: string | null) {
  const chat = Array.isArray(doc.chat) ? (doc.chat as AnyDoc[]) : []
  const viewerIsA = viewerId ? String(doc.userA) === String(viewerId) : false
  return {
    id: String(doc._id),
    userA: String(doc.userA || ""),
    userAUsername: String(doc.userAUsername || ""),
    userB: String(doc.userB || ""),
    userBUsername: String(doc.userBUsername || ""),
    itemsA: serializeItems(doc.itemsA),
    itemsB: serializeItems(doc.itemsB),
    coinsA: Number(doc.coinsA || 0),
    coinsB: Number(doc.coinsB || 0),
    status: String(doc.status || "live"),
    confirmedA: Boolean(doc.confirmedA),
    confirmedB: Boolean(doc.confirmedB),
    timerSeconds: Number(doc.timerSeconds || 0),
    expiresAt: iso(doc.expiresAt),
    completedAt: iso(doc.completedAt),
    viewerIsA,
    viewerIsParticipant: viewerId
      ? String(doc.userA) === String(viewerId) || String(doc.userB) === String(viewerId)
      : false,
    chat: chat.map((m) => ({
      id: String(m._id || ""),
      userId: String(m.userId || ""),
      username: String(m.username || ""),
      message: String(m.message || ""),
      system: Boolean(m.system),
      createdAt: iso(m.createdAt),
    })),
  }
}
