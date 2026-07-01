import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"
import ChatBlock from "@/lib/models/ChatBlock"
import User from "@/lib/models/User"
import Trade from "@/lib/models/Trade"
import Listing from "@/lib/models/Listing"
import Auction from "@/lib/models/Auction"
import { notifyChatMessage } from "@/lib/notifications"

export type ChatType = "private" | "trade" | "marketplace" | "auction"

export interface Attachment {
  url: string
  name?: string
  contentType?: string
  size?: number
}

const MAX_TEXT = 4000

/* -------------------------------------------------------------------------- */
/* Rate limiting / anti-flood (in-memory, best-effort per server instance)    */
/* -------------------------------------------------------------------------- */

const sendTimestamps = new Map<string, number[]>()
// Max messages per rolling window.
const RATE_MAX = 10
const RATE_WINDOW_MS = 10_000
// Hard minimum gap between two messages (anti-flood).
const MIN_GAP_MS = 600

/** Returns null if allowed, or an error string if the user is rate-limited. */
export function checkRateLimit(userId: string): string | null {
  const now = Date.now()
  const arr = (sendTimestamps.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS)
  if (arr.length > 0 && now - arr[arr.length - 1] < MIN_GAP_MS) {
    return "Stai inviando messaggi troppo velocemente. Rallenta."
  }
  if (arr.length >= RATE_MAX) {
    return "Hai raggiunto il limite di messaggi. Attendi qualche secondo."
  }
  arr.push(now)
  sendTimestamps.set(userId, arr)
  return null
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

/** True if `a` blocked `b` OR `b` blocked `a` (messaging is mutually disabled). */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const found = await ChatBlock.findOne({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  }).lean()
  return !!found
}

/** Returns the set of userIds that the given user has blocked. */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const rows = await ChatBlock.find({ blockerId: userId }).select("blockedId").lean()
  return rows.map((r) => String((r as { blockedId: string }).blockedId))
}

/* -------------------------------------------------------------------------- */
/* Context participant resolution                                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the counterpart user + a display label for a contextual chat.
 * Returns null if the context is invalid or the requester isn't allowed.
 */
async function resolveContext(
  type: ChatType,
  contextId: string,
  requesterId: string,
  targetUserId?: string,
): Promise<{ otherUserId: string; label: string } | null> {
  if (type === "trade") {
    const trade = await Trade.findById(contextId).lean<{ fromUserId: string; toUserId: string; requestedItemName?: string }>()
    if (!trade) return null
    const ids = [String(trade.fromUserId), String(trade.toUserId)]
    if (!ids.includes(requesterId)) return null
    const other = ids.find((id) => id !== requesterId) || ids[0]
    return { otherUserId: other, label: trade.requestedItemName || "Scambio" }
  }

  if (type === "marketplace") {
    const listing = await Listing.findById(contextId).lean<{ sellerId: unknown; itemName?: string }>()
    if (!listing) return null
    const sellerId = String(listing.sellerId)
    // Seller opening their own listing chat must specify which buyer to talk to.
    const other = requesterId === sellerId ? targetUserId : sellerId
    if (!other || other === requesterId) return null
    return { otherUserId: other, label: listing.itemName || "Annuncio" }
  }

  if (type === "auction") {
    const auction = await Auction.findById(contextId).lean<{ userId: string; itemName?: string }>()
    if (!auction) return null
    const ownerId = String(auction.userId)
    const other = requesterId === ownerId ? targetUserId : ownerId
    if (!other || other === requesterId) return null
    return { otherUserId: other, label: auction.itemName || "Asta" }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Thread creation / retrieval                                                */
/* -------------------------------------------------------------------------- */

export interface ResolveThreadInput {
  type: ChatType
  requesterId: string
  targetUserId?: string
  contextId?: string
}

/** Creates or fetches the canonical thread for the given parameters. */
export async function resolveThread(input: ResolveThreadInput) {
  await connectDB()
  const { type, requesterId } = input

  let otherUserId = input.targetUserId
  let contextId: string | null = input.contextId || null
  let label = ""

  if (type === "private") {
    if (!otherUserId || otherUserId === requesterId) {
      return { error: "Destinatario non valido." as const }
    }
    contextId = null
  } else {
    if (!contextId) return { error: "contextId richiesto per chat contestuali." as const }
    const resolved = await resolveContext(type, contextId, requesterId, input.targetUserId)
    if (!resolved) return { error: "Contesto non valido o accesso non consentito." as const }
    otherUserId = resolved.otherUserId
    label = resolved.label
  }

  // Verify the counterpart exists.
  const other = await User.findById(otherUserId).select("_id username").lean<{ _id: unknown; username: string }>()
  if (!other) return { error: "Utente destinatario non trovato." as const }

  if (await isBlockedBetween(requesterId, otherUserId!)) {
    return { error: "Non puoi avviare una chat: uno dei due utenti ha bloccato l'altro." as const }
  }

  const participants = [requesterId, otherUserId!].sort()

  const query: Record<string, unknown> = { type, participants }
  query.contextId = contextId

  let thread = await ChatThread.findOne(query)
  if (!thread) {
    thread = await ChatThread.create({
      type,
      participants,
      contextId,
      contextLabel: label,
    })
  }
  return { thread }
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                    */
/* -------------------------------------------------------------------------- */

export interface SendInput {
  threadId: string
  senderId: string
  text?: string | null
  attachments?: Attachment[]
}

export async function sendMessage(input: SendInput) {
  await connectDB()
  const { threadId, senderId } = input
  const text = (input.text || "").trim()
  const attachments = input.attachments || []

  if (!text && attachments.length === 0) {
    return { error: "Messaggio vuoto." as const }
  }
  if (text.length > MAX_TEXT) {
    return { error: "Messaggio troppo lungo." as const }
  }

  const thread = await ChatThread.findById(threadId)
  if (!thread) return { error: "Thread non trovato." as const }
  if (!thread.participants.includes(senderId)) return { error: "Accesso non autorizzato." as const }
  if (thread.status === "suspended") return { error: "Questa conversazione è stata sospesa." as const }

  const otherId = thread.participants.find((p: string) => p !== senderId)
  if (otherId && (await isBlockedBetween(senderId, otherId))) {
    return { error: "Impossibile inviare: utente bloccato." as const }
  }

  const limited = checkRateLimit(senderId)
  if (limited) return { error: limited }

  const sender = await User.findById(senderId).select("username").lean<{ username: string }>()

  const message = await ChatMessage.create({
    threadId,
    senderId,
    senderUsername: sender?.username || "",
    text: text || null,
    attachments,
    readBy: [senderId],
  })

  const preview = text ? text.slice(0, 120) : attachments.length > 0 ? "[allegato]" : ""
  thread.lastMessageText = preview
  thread.lastMessageAt = message.createdAt
  thread.lastSenderId = senderId
  await thread.save()

  // Fire-and-forget notification to the recipient (deep-links to the chat).
  if (otherId) {
    void notifyChatMessage(otherId, String(thread._id), preview, sender?.username)
  }

  return { message, thread }
}

/* -------------------------------------------------------------------------- */
/* Serializers                                                                */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeMessage(m: any) {
  return {
    id: String(m._id),
    threadId: String(m.threadId),
    senderId: String(m.senderId),
    senderUsername: m.senderUsername || "",
    text: m.deleted ? null : (m.text ?? null),
    attachments: m.deleted ? [] : (m.attachments || []),
    readBy: m.readBy || [],
    deleted: !!m.deleted,
    createdAt: m.createdAt,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeThread(t: any, viewerId?: string) {
  return {
    id: String(t._id),
    type: t.type,
    participants: t.participants || [],
    contextId: t.contextId ?? null,
    contextLabel: t.contextLabel || "",
    lastMessageText: t.lastMessageText || "",
    lastMessageAt: t.lastMessageAt || null,
    lastSenderId: t.lastSenderId || "",
    status: t.status || "active",
    unread:
      viewerId && t.lastSenderId && t.lastSenderId !== viewerId && t.lastMessageAt
        ? undefined // computed separately when needed
        : false,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}
