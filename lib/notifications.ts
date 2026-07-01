import { connectDB } from "@/lib/db"
import Notification from "@/lib/models/Notification"

// Original Blocco types are kept; Blocco 20 adds the unified event types.
export type NotificationType =
  | "auction"
  | "trade"
  | "message"
  | "system"
  | "chat"
  | "marketplace"
  | "payment"
  | "escrow"
  | "moderation"

export type NotificationContextKind = "chat" | "trade" | "listing" | "auction" | "payment" | "dispute"

export interface NotificationContext {
  kind: NotificationContextKind
  id: string
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  context?: NotificationContext | null
}

/**
 * Builds the in-app deep link for a notification context. Centralizing this
 * keeps the bell, the page and every trigger pointing at the same routes.
 */
export function linkForContext(context?: NotificationContext | null): string {
  if (!context) return ""
  switch (context.kind) {
    case "chat":
      return "/chat"
    case "trade":
      return `/trades/${context.id}`
    case "listing":
      return `/market/item/${context.id}`
    case "auction":
      return `/auctions/${context.id}`
    case "payment":
      return "/payments"
    case "dispute":
      return "/payments"
    default:
      return ""
  }
}

/**
 * Creates a notification for a user. This helper is intentionally non-blocking:
 * any failure is logged but never thrown, so it can be safely called as a
 * "fire-and-forget" trigger from existing API routes without breaking their
 * main flow.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    if (!input.userId || !input.title) return

    await connectDB()
    // Prefer an explicit link, otherwise derive one from the context.
    const link = input.link || linkForContext(input.context)
    await Notification.create({
      userId: input.userId,
      type: input.type || "system",
      title: input.title,
      body: input.body || "",
      link,
      context: input.context || null,
      read: false,
      deleted: false,
    })
  } catch (error) {
    console.error("[v0] createNotification error:", error)
  }
}

/* -------------------------------------------------------------------------- */
/* Blocco 20: typed event helpers                                             */
/*                                                                            */
/* These are thin, fire-and-forget wrappers around createNotification so the  */
/* various subsystems (chat, trades, marketplace, auctions, payments, escrow, */
/* moderation) can emit a unified, deep-linkable notification with one call.  */
/* -------------------------------------------------------------------------- */

/** New chat message received in a thread. */
export async function notifyChatMessage(recipientId: string, threadId: string, previewText: string, fromUsername?: string) {
  await createNotification({
    userId: recipientId,
    type: "chat",
    title: fromUsername ? `Nuovo messaggio da ${fromUsername}` : "Nuovo messaggio",
    body: previewText || "",
    context: { kind: "chat", id: threadId },
  })
}

/** A trade changed state (created, accepted, rejected, completed, …). */
export async function notifyTradeUpdate(userId: string, tradeId: string, status: string) {
  const labels: Record<string, string> = {
    created: "Hai ricevuto una nuova proposta di scambio",
    accepted: "Il tuo scambio è stato accettato",
    rejected: "Il tuo scambio è stato rifiutato",
    completed: "Scambio completato",
    cancelled: "Scambio annullato",
    message: "Nuovo messaggio sullo scambio",
  }
  await createNotification({
    userId,
    type: "trade",
    title: labels[status] || "Aggiornamento scambio",
    body: "",
    context: { kind: "trade", id: tradeId },
  })
}

/** A marketplace listing was sold. */
export async function notifyMarketplaceSale(sellerId: string, listingId: string) {
  await createNotification({
    userId: sellerId,
    type: "marketplace",
    title: "Hai venduto un articolo",
    body: "Un acquirente ha completato l'acquisto del tuo annuncio.",
    context: { kind: "listing", id: listingId },
  })
}

/** A new bid was placed on the owner's auction. */
export async function notifyAuctionBid(ownerId: string, auctionId: string, amount: number) {
  await createNotification({
    userId: ownerId,
    type: "auction",
    title: "Nuova offerta sulla tua asta",
    body: `Offerta di € ${Number(amount || 0).toLocaleString("it-IT")}.`,
    context: { kind: "auction", id: auctionId },
  })
}

/** Escrow funds were released to the user. */
export async function notifyEscrowReleased(userId: string, paymentId: string) {
  await createNotification({
    userId,
    type: "escrow",
    title: "Fondi rilasciati dall'escrow",
    body: "Il pagamento in garanzia è stato rilasciato.",
    context: { kind: "payment", id: paymentId },
  })
}

/** A dispute was opened on a transaction the user is part of. */
export async function notifyDisputeOpened(userId: string, contextId: string) {
  await createNotification({
    userId,
    type: "escrow",
    title: "Disputa aperta",
    body: "È stata aperta una disputa su una tua transazione.",
    context: { kind: "dispute", id: contextId },
  })
}

/** A moderation action was taken on the user's content/account. */
export async function notifyModerationAction(userId: string, action: string, contextId: string) {
  await createNotification({
    userId,
    type: "moderation",
    title: "Azione di moderazione",
    body: action || "Un amministratore ha effettuato un'azione sul tuo account o contenuto.",
    context: contextId ? { kind: "dispute", id: contextId } : null,
  })
}
