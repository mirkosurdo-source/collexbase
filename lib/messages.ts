import Conversation from "@/lib/models/Conversation"
import User from "@/lib/models/User"
import { verifyToken } from "@/lib/auth/jwt"
import { createNotification } from "@/lib/notifications"
import { evaluateFairness, suggestPrice, COINS_TO_EUR } from "@/lib/ai-advisor"

export interface OfferItem {
  id?: string
  name?: string
  image?: string
  value?: number
}

export interface OfferInput {
  offerType: "cash" | "item_cash" | "item_coins" | "multi_trade"
  proposerId: string
  amount?: number
  coins?: number
  offeredItems?: OfferItem[]
  requestedItems?: OfferItem[]
  listingId?: string
  listingName?: string
  askValue?: number
  category?: string
}

/**
 * Normalizes an offer's monetary value, computes the seller's ask value, and
 * attaches an AI advisor fairness snapshot (score, verdict, suggested counter).
 */
export function buildOffer(input: OfferInput) {
  const amount = Math.max(0, Number(input.amount) || 0)
  const coins = Math.max(0, Number(input.coins) || 0)
  const offeredItems = (input.offeredItems || []).map((i) => ({
    id: i.id || "",
    name: i.name || "",
    image: i.image || "",
    value: Math.max(0, Number(i.value) || 0),
  }))
  const requestedItems = (input.requestedItems || []).map((i) => ({
    id: i.id || "",
    name: i.name || "",
    image: i.image || "",
    value: Math.max(0, Number(i.value) || 0),
  }))

  const offeredItemsValue = offeredItems.reduce((s, i) => s + i.value, 0)
  const requestedItemsValue = requestedItems.reduce((s, i) => s + i.value, 0)

  const offerValue = amount + coins * COINS_TO_EUR + offeredItemsValue
  const askValue = Math.max(1, Number(input.askValue) || requestedItemsValue || amount || 1)

  const fairness = evaluateFairness({ askValue, offerValue })
  const demand = input.category ? suggestPrice({ value: askValue, category: input.category }).demand : 1
  const suggestedCounter = Math.round(askValue * 0.95)

  return {
    offerType: input.offerType,
    proposerId: input.proposerId,
    amount,
    coins,
    offeredItems,
    requestedItems,
    listingId: input.listingId || "",
    listingName: input.listingName || "",
    askValue,
    offerValue: Math.round(offerValue * 100) / 100,
    status: "pending" as const,
    aiScore: fairness.score,
    aiVerdict: fairness.verdict,
    aiMessage: fairness.message,
    aiSuggestedCounter: suggestedCounter,
    aiDemand: demand,
  }
}

export interface AuthedUser {
  userId: string
  username: string
  avatar: string
}

/** Extracts a JWT from the Authorization header or a body token field. */
export function extractToken(req: Request, bodyToken?: string): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) return authHeader.slice(7)
  return bodyToken || null
}

/** Verifies the request token and resolves the sender's denormalized profile. */
export async function authMessenger(req: Request, bodyToken?: string): Promise<AuthedUser | null> {
  const token = extractToken(req, bodyToken)
  if (!token) return null
  const decoded = verifyToken(token)
  if (!decoded) return null

  let username = ""
  let avatar = ""
  try {
    const sender = (await User.findById(decoded.userId).lean()) as Record<string, unknown> | null
    username = (sender?.username as string) || ""
    avatar = (sender?.avatar as string) || ""
  } catch {
    username = ""
  }
  return { userId: decoded.userId, username, avatar }
}

/** Finds the existing 1:1 conversation or creates a new one. */
export async function getOrCreateConversation(sender: AuthedUser, recipientId: string) {
  let conversation = await Conversation.findOne({
    participants: { $all: [sender.userId, recipientId] },
  })
  if (conversation) return conversation

  const recipient = (await User.findById(recipientId).lean()) as Record<string, unknown> | null
  if (!recipient) return null

  conversation = await Conversation.create({
    participants: [sender.userId, recipientId],
    participantInfo: [
      { userId: sender.userId, username: sender.username, avatar: sender.avatar },
      {
        userId: recipientId,
        username: (recipient.username as string) || "Utente",
        avatar: (recipient.avatar as string) || "",
      },
    ],
    messages: [],
    unread: {},
  })
  return conversation
}

interface MessagePayload {
  type?: "text" | "image" | "attachment" | "offer"
  text?: string
  imageUrl?: string
  attachment?: { url: string; name: string; size: number; contentType: string }
  offer?: Record<string, unknown>
}

const SNAPSHOTS: Record<string, string> = {
  image: "Foto",
  attachment: "Allegato",
  offer: "Proposta di scambio",
}

const NOTIFY_TITLE: Record<string, string> = {
  text: "Nuovo messaggio",
  image: "Foto ricevuta",
  attachment: "Allegato ricevuto",
  offer: "Nuova offerta",
}

/**
 * Appends a message to a conversation, updates the snapshot + unread counters,
 * recomputes the active-negotiation flag, saves, and notifies the recipient.
 * Returns the persisted message subdocument.
 */
export async function appendMessage(
  conversation: InstanceType<typeof Conversation>,
  sender: AuthedUser,
  payload: MessagePayload,
) {
  const type = payload.type || "text"
  const text = (payload.text || "").trim()

  conversation.messages.push({
    senderId: sender.userId,
    senderUsername: sender.username,
    type,
    text,
    imageUrl: payload.imageUrl || "",
    attachment: payload.attachment,
    offer: payload.offer,
    readBy: [sender.userId],
    createdAt: new Date(),
  })

  const snapshot = type === "text" ? text : SNAPSHOTS[type] || "Messaggio"
  conversation.lastMessage = snapshot.length > 120 ? `${snapshot.slice(0, 120)}...` : snapshot
  conversation.lastSenderId = sender.userId
  conversation.lastMessageAt = new Date()

  const recipient = (conversation.participants as string[]).find((p: string) => p !== sender.userId) || ""
  if (recipient) {
    const current = Number(conversation.unread?.get?.(recipient) || 0)
    conversation.unread.set(recipient, current + 1)
  }

  // Recompute active negotiation: any pending offer in the thread.
  conversation.activeNegotiation = (conversation.messages as Array<Record<string, unknown>>).some(
    (m) => m.type === "offer" && (m.offer as Record<string, unknown> | undefined)?.status === "pending",
  )

  await conversation.save()

  const created = conversation.messages[conversation.messages.length - 1]

  if (recipient) {
    const preview =
      type === "text" ? (text.length > 80 ? `${text.slice(0, 80)}...` : text) : SNAPSHOTS[type] || ""
    await createNotification({
      userId: recipient,
      type: "message",
      title: NOTIFY_TITLE[type] || "Nuovo messaggio",
      body: `${sender.username || "Un utente"}${preview ? `: ${preview}` : ""}`,
      link: `/messages/${conversation._id}`,
    })
  }

  return created
}

/** Returns true if the userId is a participant of the conversation. */
export function isParticipant(conversation: InstanceType<typeof Conversation>, userId: string): boolean {
  return (conversation.participants as string[]).includes(userId)
}

/** Recomputes the activeNegotiation flag from the current messages. */
export function recomputeNegotiation(conversation: InstanceType<typeof Conversation>) {
  conversation.activeNegotiation = (conversation.messages as Array<Record<string, unknown>>).some(
    (m) => m.type === "offer" && (m.offer as Record<string, unknown> | undefined)?.status === "pending",
  )
}

/**
 * Transitions an embedded offer's status and notifies the counterparty.
 * `actorId` is the user performing the action.
 */
export async function setOfferStatus(
  conversation: InstanceType<typeof Conversation>,
  messageId: string,
  newStatus: "accepted" | "rejected" | "withdrawn" | "countered",
  actor: AuthedUser,
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const msg = (conversation.messages as Array<Record<string, unknown>>).find(
    (m) => String((m as { _id?: unknown })._id) === messageId && m.type === "offer",
  )
  if (!msg || !msg.offer) return { ok: false, error: "Offerta non trovata.", status: 404 }

  const offer = msg.offer as Record<string, unknown>
  if (offer.status !== "pending") {
    return { ok: false, error: "Questa offerta non è più in attesa.", status: 400 }
  }

  const proposerId = String(offer.proposerId)
  if (newStatus === "withdrawn" && actor.userId !== proposerId) {
    return { ok: false, error: "Solo chi ha proposto può ritirare l'offerta.", status: 403 }
  }
  if ((newStatus === "accepted" || newStatus === "rejected") && actor.userId === proposerId) {
    return { ok: false, error: "Non puoi rispondere alla tua stessa offerta.", status: 403 }
  }

  offer.status = newStatus
  recomputeNegotiation(conversation)
  await conversation.save()

  const counterparty =
    actor.userId === proposerId
      ? (conversation.participants as string[]).find((p) => p !== actor.userId) || ""
      : proposerId

  const LABELS: Record<string, string> = {
    accepted: "Offerta accettata",
    rejected: "Offerta rifiutata",
    withdrawn: "Offerta ritirata",
    countered: "Controproposta ricevuta",
  }

  if (counterparty) {
    await createNotification({
      userId: counterparty,
      type: "message",
      title: LABELS[newStatus],
      body: `${actor.username || "Un utente"} ha aggiornato una proposta di scambio.`,
      link: `/messages/${conversation._id}`,
    })
  }

  return { ok: true }
}
